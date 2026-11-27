import { useState, useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthProvider from './context/AuthProvider';
import CompaniesProvider from './context/CompaniesProvider';
import FavoritesProvider from './context/FavoritesProvider';
import AppShell from './components/AppShell';
import WorkspaceHome from './components/WorkspaceHome';

const SingleTickerTab = lazy(() => import('./components/SingleTickerTab'));
const FavoritesTab = lazy(() => import('./components/FavoritesTab'));
const BulkIngestionTab = lazy(() => import('./components/BulkIngestionTab'));
const TagSearchTab = lazy(() => import('./components/TagSearchTab'));
const TermsOfService = lazy(() => import('./components/TermsOfService'));

function getInitialTheme() {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') return stored;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // Fallback to light
  }
  return 'light';
}

function RouteFallback() {
  return (
    <div className="space-y-4 animate-pulse py-4" aria-busy="true">
      <div className="h-24 rounded-xl bg-surface border border-line" />
      <div className="h-64 rounded-xl bg-surface border border-line" />
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <HashRouter>
      <AuthProvider>
        <CompaniesProvider>
          <FavoritesProvider>
            <AppShell theme={theme} toggleTheme={toggleTheme}>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<WorkspaceHome />} />
                  <Route path="/favorites" element={<FavoritesTab />} />
                  <Route path="/ticker" element={<SingleTickerTab />} />
                  <Route path="/ticker/:symbol" element={<SingleTickerTab />} />
                  <Route path="/screener" element={<TagSearchTab />} />
                  <Route path="/ingest" element={<BulkIngestionTab />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </AppShell>
          </FavoritesProvider>
        </CompaniesProvider>
      </AuthProvider>
    </HashRouter>
  );
}

export default App;
