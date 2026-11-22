import { useState, useEffect, useCallback } from 'react';
import { CompaniesContext } from './companiesStore';

const RECENT_KEY = 'stockclue_recent_tickers';
const MAX_RECENT = 8;

function loadRecentTickers() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function CompaniesProvider({ children }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recentTickers, setRecentTickers] = useState(loadRecentTickers);

  const refreshCompanies = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiBase}/api/companies`);
      if (!response.ok) {
        throw new Error('Failed to load companies from backend database.');
      }
      const data = await response.json();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to connect to the backend server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    fetch(`${apiBase}/api/companies`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load companies from backend database.');
        }
        return response.json();
      })
      .then((data) => {
        if (!cancelled) {
          setCompanies(Array.isArray(data) ? data : []);
          setError('');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Unable to connect to the backend server.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const recordRecentTicker = useCallback((ticker, name = '') => {
    if (!ticker) return;
    const sym = ticker.toUpperCase();
    setRecentTickers((prev) => {
      const filtered = prev.filter((item) => item.ticker !== sym);
      const next = [
        { ticker: sym, name: name || sym, viewedAt: Date.now() },
        ...filtered,
      ].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  }, []);

  return (
    <CompaniesContext.Provider
      value={{
        companies,
        loading,
        error,
        refreshCompanies,
        recentTickers,
        recordRecentTicker,
      }}
    >
      {children}
    </CompaniesContext.Provider>
  );
}
