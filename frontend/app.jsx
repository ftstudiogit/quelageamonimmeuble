// Quel âge a mon immeuble — App shell

const { useState: useStateApp, useEffect: useEffectApp } = React;

function App() {
  // view = 'landing' | 'loading' | 'result' | 'error'
  const [view, setView] = useStateApp('landing');
  const [query, setQuery] = useStateApp('');
  const [current, setCurrent] = useStateApp(null);
  const [errorMsg, setErrorMsg] = useStateApp('');

  const doLookup = async (q) => {
    setQuery(q);
    setView('loading');
    try {
      const result = await window.apiLookup(q);
      setCurrent(result);
      setView('result');
    } catch (err) {
      setErrorMsg(err.message || 'Erreur inattendue.');
      setView('error');
    }
  };

  const onBack = () => {
    setView('landing');
    setCurrent(null);
    setErrorMsg('');
  };

  return (
    <React.Fragment>
      <Masthead onLogoClick={onBack} />
      {view === 'landing' && <Landing onSubmit={doLookup} />}
      {view === 'loading' && <Loading query={query} />}
      {view === 'result' && current && <Result entry={current} onBack={onBack} />}
      {view === 'error' && <ErrorState message={errorMsg} onBack={onBack} />}
      <Footer />
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
