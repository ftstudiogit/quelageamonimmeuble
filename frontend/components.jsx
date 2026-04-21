// Quel âge a mon immeuble — Landing + Result components

const { useState, useEffect, useRef } = React;

const API_BASE = window.__API_BASE__ || 'http://127.0.0.1:8002';

// ----- API client ----------------------------------------------------------

// Render free tier sleeps after 15 min. Kick the API awake on page load so
// the first real request doesn't have to wait on a cold start.
(function warmApi() {
  try {
    fetch(`${API_BASE}/api/health`, { cache: 'no-store' }).catch(() => {});
  } catch (e) {}
})();

async function fetchWithRetry(url, { retries = 3, delayMs = 1200 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      // During cold start Render's edge sometimes returns 404 "Not Found"
      // as text/plain. Retry those silently.
      const ct = r.headers.get('content-type') || '';
      if (r.status === 404 && !ct.includes('json')) {
        lastErr = new Error('cold-start edge 404');
      } else {
        return r;
      }
    } catch (e) {
      lastErr = e;
    }
    if (attempt < retries) {
      await new Promise((res) => setTimeout(res, delayMs * (attempt + 1)));
    }
  }
  throw lastErr || new Error('fetch failed');
}

async function apiSearch(q) {
  try {
    const r = await fetchWithRetry(
      `${API_BASE}/api/search?q=${encodeURIComponent(q)}`,
      { retries: 1, delayMs: 400 }
    );
    if (!r.ok) return [];
    const data = await r.json();
    return data.suggestions || [];
  } catch (e) {
    return [];
  }
}

async function apiLookup(q) {
  let r;
  try {
    r = await fetchWithRetry(
      `${API_BASE}/api/lookup?q=${encodeURIComponent(q)}`
    );
  } catch (e) {
    const err = new Error(
      "Le service se réveille — réessayez dans quelques secondes."
    );
    err.status = 0;
    throw err;
  }
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    const err = new Error(body.detail || 'Erreur serveur.');
    err.status = r.status;
    throw err;
  }
  return r.json();
}

// ----- Logo / Masthead -----------------------------------------------------

function Logo({ onClick }) {
  return (
    <div className="logo" onClick={onClick} role="button" tabIndex={0}>
      Quel âge a mon immeuble
    </div>
  );
}

function Masthead({ onLogoClick }) {
  return (
    <header className="masthead">
      <Logo onClick={onLogoClick} />
    </header>
  );
}

// ----- Search bar ----------------------------------------------------------

function SearchBar({ onSubmit, autoFocus = false }) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);
  // Monotonic counter so that a slow earlier fetch doesn't overwrite a
  // later, more relevant one (race condition on debounced autocomplete).
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, [autoFocus]);

  useEffect(() => {
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Debounced autocomplete fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const mySeq = ++requestSeqRef.current;
      const s = await apiSearch(value.trim());
      // Ignore if a newer request has been fired in the meantime.
      if (mySeq !== requestSeqRef.current) return;
      setSuggestions(s);
    }, 180);
    return () => clearTimeout(debounceRef.current);
  }, [value]);

  const submit = (query) => {
    if (!query) return;
    onSubmit(query);
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIdx >= 0 && suggestions[focusedIdx]) {
        submit(suggestions[focusedIdx].label);
      } else {
        submit(value.trim());
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="search-wrap" ref={wrapRef}>
      <div className="search-field">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          name="q"
          placeholder="Une adresse parisienne…"
          value={value}
          onChange={(e) => { setValue(e.target.value); setOpen(true); setFocusedIdx(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck="false"
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          data-form-type="other"
          aria-autocomplete="list"
          role="combobox"
        />
        <button
          className={`search-submit ${value ? 'active' : ''}`}
          onClick={() => submit(value.trim())}
          disabled={!value}
        >
          Révéler →
        </button>
      </div>

      {open && suggestions.length > 0 && (
        <div className="autocomplete">
          {suggestions.map((s, i) => (
            <div
              key={s.label}
              className={`ac-item ${i === focusedIdx ? 'focused' : ''}`}
              onMouseEnter={() => setFocusedIdx(i)}
              onClick={() => submit(s.label)}
            >
              <span className="ac-item-label">{s.display}</span>
              <span className="ac-item-meta">
                {s.arrondissement.replace('Paris', '').trim()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ----- Landing -------------------------------------------------------------

const EXAMPLES = [
  '14 rue Saint-Maur 75011 Paris',
  '34 rue Legendre 75017 Paris',
  '18 rue Bichat 75010 Paris',
];

function Landing({ onSubmit }) {
  return (
    <main className="landing">
      <h1>
        Votre immeuble<br />a quel <em>âge</em> ?
      </h1>
      <p className="landing-sub">
        L'année de construction de toute adresse parisienne,
        et l'histoire qui va avec.
      </p>
      <SearchBar onSubmit={onSubmit} autoFocus />

      <div className="examples">
        <span className="examples-label">Essayer —</span>
        {EXAMPLES.map((ex) => (
          <button key={ex} className="tag" onClick={() => onSubmit(ex)}>
            {ex.replace(/ 75\d{3} Paris$/, '')}
          </button>
        ))}
      </div>

      <section className="pitch">
        <h2 className="pitch-title">À quoi ça sert ?</h2>
        <p>
          L'année de construction d'un immeuble est demandée dans de nombreuses
          démarches : <strong>encadrement des loyers à Paris</strong> (le loyer
          de référence dépend de l'époque), <strong>diagnostics obligatoires</strong>{' '}
          avant vente ou location (plomb avant 1949, amiante avant 1997),
          <strong> calcul du DPE</strong>, éligibilité aux{' '}
          <strong>aides à la rénovation</strong> (MaPrimeRénov' exige souvent
          plus de quinze ans), tarification d'<strong>assurance habitation</strong>,{' '}
          <strong>estimation immobilière</strong>.
        </p>
        <p>
          Le site vous donne la date et quelques repères historiques sur
          l'époque de construction. Sources : Base de Données Nationale des
          Bâtiments (CSTB, fichiers fonciers DGFiP), Base Adresse Nationale,
          Wikipédia.
        </p>
      </section>
    </main>
  );
}

// ----- Year hero (split digits for animation) ----------------------------

function YearHero({ year }) {
  const digits = String(year).split('');
  return (
    <div className="year-hero">
      <div className="year serif" key={year}>
        {digits.map((d, i) => (
          <span className="digit" key={i}>{d}</span>
        ))}
      </div>
    </div>
  );
}

// ----- Loading state -----------------------------------------------------

function Loading({ query }) {
  return (
    <main className="result">
      <div className="result-address">
        {query}
      </div>
      <div className="year-hero">
        <div className="year serif" style={{ opacity: 0.12 }}>····</div>
      </div>
      <div className="era" style={{ opacity: 0.5 }}>Recherche en cours…</div>
    </main>
  );
}

// ----- Error state -------------------------------------------------------

function ErrorState({ message, onBack }) {
  return (
    <main className="result">
      <div className="era" style={{ marginTop: 120, fontStyle: 'normal' }}>
        {message}
      </div>
      <div className="back-cta">
        <button className="back-link" onClick={onBack}>
          Chercher une autre adresse
        </button>
      </div>
    </main>
  );
}

// ----- Result page -------------------------------------------------------

function ReliabilityBadge({ reliability }) {
  if (!reliability) return null;
  return (
    <div className={`reliability reliability-${reliability.level}`}>
      <span className="reliability-dot" aria-hidden="true" />
      {reliability.label}
    </div>
  );
}

function Result({ entry, onBack }) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [entry]);

  return (
    <main className="result" key={`${entry.display}-${entry.year}`}>
      <div className="result-address">
        {entry.display}
        <span className="arr">{entry.arrondissement}</span>
      </div>

      <YearHero year={entry.year} />
      <div className="era">{entry.era}</div>
      <ReliabilityBadge reliability={entry.reliability} />

      <hr className="hairline" />

      <section className="section">
        <div className="section-label">Contexte architectural</div>
        <div className="section-body">
          {entry.context}
        </div>
      </section>

      {entry.facts && entry.facts.length > 0 && (
        <>
          <hr className="hairline" />
          <section className="section">
            <div className="section-label">Cette année-là · {entry.year}</div>
            <ul className="chrono">
              {entry.facts.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </section>
        </>
      )}

      <div className="back-cta">
        <button className="back-link" onClick={onBack}>
          Chercher une autre adresse
        </button>
      </div>
    </main>
  );
}

// ----- Footer -----------------------------------------------------------

function Footer() {
  return (
    <footer className="footer">
      <div>
        Sources —{' '}
        <span style={{ color: 'var(--ink-soft)' }}>BDNB</span>
        <span className="sep">·</span>
        <span style={{ color: 'var(--ink-soft)' }}>Base Adresse Nationale</span>
        <span className="sep">·</span>
        <span style={{ color: 'var(--ink-soft)' }}>Wikipédia</span>
      </div>
      <div>
        Un projet de{' '}
        <a
          href="https://francoistruong.fr/"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-link"
        >
          François Truong
        </a>
      </div>
    </footer>
  );
}

Object.assign(window, {
  Landing, Result, Masthead, Footer, SearchBar, Loading, ErrorState,
  apiLookup, apiSearch,
});
