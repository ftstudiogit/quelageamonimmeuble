# Quel âge a mon immeuble

L'année de construction de toute adresse parisienne, et l'histoire qui va avec.

Sources : **BDNB** (CSTB — fichiers fonciers DGFiP), **Base Adresse Nationale** (adresse.data.gouv.fr), **Wikipédia FR**.

## Stack

- `frontend/` — HTML + CSS + React via CDN, avec Babel-in-browser (pas de build).
- `backend/` — FastAPI + httpx + BeautifulSoup, appelle BDNB et Wikipédia.

## Développement local

Lancer les deux serveurs en parallèle :

```bash
# Terminal 1 — API
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --reload --port 8002

# Terminal 2 — Front (serveur statique, n'importe lequel)
cd frontend
python3 -m http.server 8001
```

Puis ouvrir http://127.0.0.1:8001.

## Déploiement

- **Front** → Cloudflare Pages (répertoire `frontend/`).
- **API** → Render (service web Python, répertoire `backend/`).

Après déploiement, mettre à jour `window.__API_BASE__` dans `frontend/index.html` pour pointer vers l'URL Render.
