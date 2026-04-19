"""Wikipedia FR — extract "Cette année-là" facts for a given year.

Strategy:
  1. Try article "YYYY_en_France" (dedicated French chronology).
  2. Fall back to the generic year article "YYYY" if unavailable.
  3. Parse the first "Événements" section, extract top-level <li> items.

Returns a cleaned list of short sentences (no wiki markup, no citations).
Cached in-process to stay polite with Wikipedia's servers.
"""
import re
from typing import Optional

import httpx
from bs4 import BeautifulSoup

WIKI_API = "https://fr.wikipedia.org/w/api.php"

# Simple in-process cache keyed by (page, section_index).
_CACHE: dict[tuple[str, int], list[str]] = {}


async def _fetch_section_html(page: str, section: int = 1) -> Optional[str]:
    """Return the HTML of a given section of a Wikipedia page, or None."""
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(
                WIKI_API,
                params={
                    "action": "parse",
                    "page": page,
                    "format": "json",
                    "prop": "text",
                    "section": section,
                    "disabletoc": 1,
                    "redirects": 1,
                },
                headers={"User-Agent": "MILLESIMMO/0.1 (https://millesimmo.local)"},
            )
    except httpx.HTTPError:
        return None
    if r.status_code != 200:
        return None
    data = r.json()
    if "error" in data:
        return None
    return data.get("parse", {}).get("text", {}).get("*")


MAX_FACT_LEN = 260


def _clean_li(li) -> str:
    """Strip refs and collapse whitespace from a BeautifulSoup <li>."""
    for s in li.find_all("sup", class_="reference"):
        s.decompose()
    for s in li.find_all("style"):
        s.decompose()
    # Skip nested <ul> children — we only want the top-level sentence.
    for ul in li.find_all("ul", recursive=False):
        ul.decompose()
    text = li.get_text(" ", strip=True)
    # Collapse internal whitespace.
    text = re.sub(r"\s+", " ", text).strip()
    # Drop stray space before punctuation ("Paris , 1860" -> "Paris, 1860").
    text = re.sub(r"\s+([,.;:!?»])", r"\1", text)
    text = re.sub(r"([«])\s+", r"\1 ", text)
    # Drop stray space after an apostrophe ("l’ enceinte" -> "l’enceinte").
    text = re.sub(r"([’'])\s+", r"\1", text)
    # Remove stray trailing footnote markers like "[1]" left over.
    text = re.sub(r"\s*\[\s*\d+\s*\]\s*$", "", text).strip()
    return text


def _first_sentence(text: str) -> str:
    """Keep only the first sentence-ish chunk, up to MAX_FACT_LEN."""
    # Split on sentence boundaries — period, ? ! followed by space+capital.
    m = re.search(r"(?<=[\.!?])\s+(?=[A-ZÉÈÀÂÎÔÛÇ])", text)
    if m:
        return text[: m.start()].rstrip()
    return text


def _looks_substantive(s: str) -> bool:
    """Filter out nav/boilerplate items (very short, dates only, etc.)."""
    if len(s) < 40:
        return False
    # Reject entries that are purely a date + colon (nested headers).
    if re.fullmatch(r"(?:\d+\s+\w+\s*:?\s*)", s, flags=re.UNICODE):
        return False
    return True


def _finalize(text: str) -> Optional[str]:
    """Take first sentence + enforce max length. Return None if unusable."""
    t = _first_sentence(text)
    if len(t) > MAX_FACT_LEN:
        return None
    if not _looks_substantive(t):
        return None
    return t


def _extract_items(html: str, limit: int = 4) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    ul = soup.find("ul")
    if not ul:
        return []
    items: list[str] = []
    for li in ul.find_all("li", recursive=False):
        # Top-level <li> often starts with a date like "15 janvier :"
        # and sometimes contains a nested <ul> of same-day sub-events.
        # Try the nested <ul> items first — they are usually the narrative lines.
        nested = li.find("ul", recursive=False)
        if nested:
            for sub in nested.find_all("li", recursive=False):
                t = _finalize(_clean_li(sub))
                if t:
                    items.append(t)
                    if len(items) >= limit:
                        return items
        else:
            t = _finalize(_clean_li(li))
            if t:
                items.append(t)
                if len(items) >= limit:
                    return items
    return items


async def year_facts(year: int, limit: int = 4) -> list[str]:
    """Return up to `limit` short factual lines about the given year, in French."""
    key = (f"{year}_en_France", limit)
    if key in _CACHE:
        return _CACHE[key]

    html = await _fetch_section_html(f"{year}_en_France", section=1)
    if html:
        facts = _extract_items(html, limit=limit)
        if facts:
            _CACHE[key] = facts
            return facts

    # Fallback to the generic year article.
    key2 = (str(year), limit)
    if key2 in _CACHE:
        return _CACHE[key2]
    html2 = await _fetch_section_html(str(year), section=1)
    if html2:
        facts = _extract_items(html2, limit=limit)
        _CACHE[key2] = facts
        return facts

    return []
