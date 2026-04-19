"""MILLESIMMO backend — FastAPI.

Endpoints:
  GET /api/search?q=...   -> BAN autocomplete (Paris only)
  GET /api/lookup?q=...   -> address -> {year, era, context, display, arrondissement}

Data flow:
  address (string)
    -> BAN geocoding (adresse.data.gouv.fr)    : normalized display + lat/lon
    -> BDNB API (api-portail.bdnb.io)          : construction year from lat/lon
    -> eras.classify(year)                      : label + architectural context
"""
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from eras import classify
from wikipedia import year_facts

BDNB_BASE = "https://api.bdnb.io/v1/bdnb"
BAN_BASE = "https://api-adresse.data.gouv.fr"

app = FastAPI(title="Quel âge a mon immeuble", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_methods=["GET"],
    allow_headers=["*"],
)


# ---------- BAN (adresse geocoding) -----------------------------------------

PARIS_CITYCODE = "75056"  # Paris commune INSEE code — restricts BAN to intra-muros


async def ban_search(q: str, limit: int = 5, autocomplete: bool = True) -> list[dict]:
    """Geocode via the Base Adresse Nationale, restricted to Paris.

    ``autocomplete=True`` is the fuzzy mode used by the typeahead: BAN returns
    partial prefix matches with lower scores. Set to ``False`` for strict
    matching on final lookups.
    """
    async with httpx.AsyncClient(timeout=8.0) as client:
        r = await client.get(
            f"{BAN_BASE}/search/",
            params={
                "q": q,
                "limit": limit,
                "autocomplete": 1 if autocomplete else 0,
                "type": "housenumber",
                "citycode": PARIS_CITYCODE,
            },
        )
    r.raise_for_status()
    return r.json().get("features", [])


def ban_feature_to_suggestion(f: dict) -> dict:
    p = f["properties"]
    lon, lat = f["geometry"]["coordinates"]
    return {
        "display": p.get("name", p.get("label", "")),
        "label": p.get("label", ""),
        "arrondissement": f"{p.get('postcode', '')} {p.get('city', '')}".strip(),
        "lat": lat,
        "lon": lon,
        "ban_id": p.get("id"),  # e.g. "75108_3518_00055" — matches BDNB cle_interop_adr
    }


# ---------- BDNB (construction year) ----------------------------------------

# Map BDNB's free-text reliability labels to a 3-level badge.
# Source: field `fiabilite_cr_adr_niv_1` on batiment_groupe_complet.
_RELIABILITY_MAP = {
    "données croisées à l'adresse fiables": ("haute", "Haute fiabilité"),
    "données croisées à l'adresse moins fiables": ("moyenne", "Fiabilité moyenne"),
    "problème de géocodage": ("faible", "Fiabilité faible"),
    "adresse non croisée": ("faible", "Fiabilité faible"),
}


def reliability_from_bdnb(raw: Optional[str]) -> dict:
    if not raw:
        return {"level": "inconnue", "label": "Fiabilité inconnue"}
    level, label = _RELIABILITY_MAP.get(
        raw.strip().lower(), ("moyenne", "Fiabilité moyenne")
    )
    return {"level": level, "label": label}


async def bdnb_building_from_ban_id(ban_id: str) -> Optional[dict]:
    """Resolve a BAN address key to building year + reliability via the BDNB
    open API. Two-step query: address → building_group → {year, reliability}.
    """
    if not ban_id:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0, base_url=BDNB_BASE) as client:
            r1 = await client.get(
                "/donnees/rel_batiment_groupe_adresse",
                params={
                    "cle_interop_adr": f"eq.{ban_id}",
                    "select": "batiment_groupe_id,fiabilite",
                    "order": "fiabilite.desc",
                    "limit": 1,
                },
            )
            if r1.status_code != 200 or not r1.json():
                return None
            bg_id = r1.json()[0]["batiment_groupe_id"]

            r2 = await client.get(
                "/donnees/batiment_groupe_complet",
                params={
                    "batiment_groupe_id": f"eq.{bg_id}",
                    "select": "annee_construction,annee_construction_dpe,"
                              "fiabilite_cr_adr_niv_1,fiabilite_cr_adr_niv_2",
                    "limit": 1,
                },
            )
    except httpx.HTTPError:
        return None
    if r2.status_code != 200 or not r2.json():
        return None
    row = r2.json()[0]
    try:
        year = int(row["annee_construction"]) if row.get("annee_construction") else None
    except (TypeError, ValueError):
        year = None
    if year is None:
        return None
    return {
        "year": year,
        "year_dpe": row.get("annee_construction_dpe"),
        "reliability": reliability_from_bdnb(row.get("fiabilite_cr_adr_niv_1")),
    }


# ---------- ADEME DPE fallback ---------------------------------------------

async def ademe_year_from_address(label: str) -> Optional[int]:
    """Fallback via the ADEME DPE public API. No auth. Coverage is partial."""
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(
                "https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines",
                params={"q": label, "size": 1, "select": "Année_construction"},
            )
    except httpx.HTTPError:
        return None
    if r.status_code != 200:
        return None
    items = r.json().get("results", [])
    if not items:
        return None
    y = items[0].get("Année_construction") or items[0].get("annee_construction")
    try:
        return int(y) if y else None
    except (TypeError, ValueError):
        return None


# ---------- Routes ----------------------------------------------------------

@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/search")
async def search(q: str = Query(..., min_length=2), limit: int = 5):
    """Autocomplete — returns Paris addresses matching q."""
    features = await ban_search(q, limit=limit, autocomplete=True)
    return {"suggestions": [ban_feature_to_suggestion(f) for f in features]}


# Minimum BAN score to accept a result for the final lookup. BAN returns a
# score in [0, 1]; below 0.55 the match is too fuzzy (typos and partial
# queries can otherwise return popular-but-unrelated streets like Rue Lecourbe).
LOOKUP_MIN_SCORE = 0.55


@app.get("/api/lookup")
async def lookup(q: str = Query(..., min_length=2)):
    """Full lookup: address -> year + era + context + reliability."""
    # Strict match first (autocomplete=0). If that fails, fall back to fuzzy
    # with a score guard so we don't silently swap the user's address.
    features = await ban_search(q, limit=1, autocomplete=False)
    if not features:
        features = await ban_search(q, limit=1, autocomplete=True)

    if not features:
        raise HTTPException(404, detail="Adresse introuvable à Paris.")

    top = features[0]
    score = top.get("properties", {}).get("score", 0) or 0
    if score < LOOKUP_MIN_SCORE:
        raise HTTPException(
            404,
            detail=(
                "Adresse trop imprécise. Essayez le format complet : "
                "« 12 rue de l'Odéon 75006 »."
            ),
        )

    sugg = ban_feature_to_suggestion(top)

    bdnb = await bdnb_building_from_ban_id(sugg["ban_id"])
    year = bdnb["year"] if bdnb else None
    reliability = bdnb["reliability"] if bdnb else None
    source = "BDNB"

    if year is None:
        year = await ademe_year_from_address(sugg["label"])
        source = "ADEME / DPE" if year else None
        reliability = {"level": "inconnue", "label": "Fiabilité inconnue"} if year else None

    if year is None:
        raise HTTPException(
            404,
            detail=(
                "Nous n'avons pas trouvé l'année de construction de ce bâtiment. "
                "La BDNB ne couvre pas encore cette parcelle."
            ),
        )

    era = classify(int(year))
    facts = await year_facts(int(year), limit=4)
    return {
        "display": sugg["display"],
        "arrondissement": sugg["arrondissement"],
        "year": int(year),
        "era": era["label"],
        "context": era["context"],
        "source": source,
        "reliability": reliability,
        "facts": facts,
    }
