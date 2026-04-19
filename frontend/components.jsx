// Quel âge a mon immeuble — Landing + Result components

const { useState, useEffect, useRef } = React;

const API_BASE = window.__API_BASE__ || 'http://127.0.0.1:8002';

// ----- API client ----------------------------------------------------------

async function apiSearch(q) {
  const r = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(q)}`);
  if (!r.ok) return [];
  const data = await r.json();
  return data.suggestions || [];
}

async function apiLookup(q) {
  const r = await fetch(`${API_BASE}/api/lookup?q=${encodeURIComponent(q)}`);
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
      <div className="masthead-meta">Paris — fichiers fonciers</div>
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
      const s = await apiSearch(value.trim());
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
          type="text"
          placeholder="Une adresse parisienne…"
          value={value}
          onChange={(e) => { setValue(e.target.value); setOpen(true); setFocusedIdx(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck="false"
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
  '55 rue du Faubourg Saint-Honoré 75008 Paris',
  "12 rue de l'Odéon 75006 Paris",
  '34 rue du Faubourg Saint-Antoine 75012 Paris',
];

function Landing({ onSubmit }) {
  return (
    <main className="landing">
      <div className="landing-eyebrow">N° 01 — Découvrir</div>
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
      <div>© MMXXVI · Paris</div>
    </footer>
  );
}

Object.assign(window, {
  Landing, Result, Masthead, Footer, SearchBar, Loading, ErrorState,
  apiLookup, apiSearch,
});
