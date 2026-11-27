import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './authStore';
import { FavoritesContext } from './favoritesStore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function extractErrorMessage(response, fallback) {
  try {
    const body = await response.json();
    if (typeof body?.detail === 'string' && body.detail.trim()) {
      return body.detail;
    }
    if (Array.isArray(body?.detail) && body.detail[0]?.msg) {
      return body.detail[0].msg;
    }
  } catch {
    // Ignore non-JSON bodies
  }
  return fallback;
}

export default function FavoritesProvider({ children }) {
  const {
    user,
    isAuthenticated,
    authFetch,
    openSignInModal,
    signInModalOpen,
  } = useAuth();

  const activeUid = user?.uid || '';

  const [favoritesState, setFavoritesState] = useState({
    uid: '',
    items: [],
    error: '',
  });
  const [refreshing, setRefreshing] = useState(false);
  const [pendingTickers, setPendingTickers] = useState(() => new Set());

  const pendingStarAfterSignInRef = useRef(null);

  const setTickerPending = useCallback((ticker, isPending) => {
    const sym = String(ticker || '').toUpperCase();
    if (!sym) return;
    setPendingTickers((prev) => {
      const next = new Set(prev);
      if (isPending) next.add(sym);
      else next.delete(sym);
      return next;
    });
  }, []);

  const clearError = useCallback(() => {
    setFavoritesState((prev) => ({ ...prev, error: '' }));
  }, []);

  const requestFavorites = useCallback(
    async (uid, { refreshQuotes = false } = {}) => {
      const params = new URLSearchParams({
        include_quotes: 'true',
        refresh_quotes: String(Boolean(refreshQuotes)),
      });
      const response = await authFetch(`${API_BASE}/api/favorites?${params.toString()}`);
      if (!response.ok) {
        const msg = await extractErrorMessage(response, 'Unable to load your favorites.');
        throw new Error(msg);
      }
      const data = await response.json();
      const items = Array.isArray(data?.favorites) ? data.favorites : [];
      return { uid, items };
    },
    [authFetch]
  );

  const addFavorite = useCallback(
    async (stockMeta) => {
      const sym = String(stockMeta?.ticker || '').trim().toUpperCase();
      if (!sym) return null;

      if (!isAuthenticated || !activeUid) {
        pendingStarAfterSignInRef.current = {
          ticker: sym,
          name: stockMeta?.name || sym,
          industry: stockMeta?.industry || '',
          last_known_price: stockMeta?.last_known_price ?? null,
          model_mos_price: stockMeta?.model_mos_price ?? null,
        };
        openSignInModal(
          `Favorites are only available for signed-in users. Sign in to add ${sym} to your Favorites list and track your Margin of Safety buy price.`
        );
        return null;
      }

      setTickerPending(sym, true);
      setFavoritesState((prev) => ({ ...prev, error: '' }));

      try {
        const body = {
          name: stockMeta?.name || sym,
          industry: stockMeta?.industry || undefined,
          last_known_price:
            stockMeta?.last_known_price > 0 ? Number(stockMeta.last_known_price) : undefined,
          model_mos_price:
            stockMeta?.model_mos_price > 0 ? Number(stockMeta.model_mos_price) : undefined,
        };
        const response = await authFetch(
          `${API_BASE}/api/favorites/${encodeURIComponent(sym)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        );

        if (response.status === 401) {
          openSignInModal('Please sign in again to save stocks to your Favorites.');
          return null;
        }
        if (!response.ok) {
          const msg = await extractErrorMessage(response, `Failed to add ${sym} to favorites.`);
          throw new Error(msg);
        }

        const saved = await response.json();
        setFavoritesState((prev) => {
          const currentItems = prev.uid === activeUid ? prev.items : [];
          const filtered = currentItems.filter((item) => item.ticker !== saved.ticker);
          return {
            uid: activeUid,
            items: [saved, ...filtered],
            error: '',
          };
        });
        return saved;
      } catch (err) {
        setFavoritesState((prev) => ({
          ...prev,
          uid: activeUid,
          error: err?.message || `Failed to add ${sym} to favorites.`,
        }));
        return null;
      } finally {
        setTickerPending(sym, false);
      }
    },
    [isAuthenticated, activeUid, authFetch, openSignInModal, setTickerPending]
  );

  const removeFavorite = useCallback(
    async (ticker) => {
      const sym = String(ticker || '').trim().toUpperCase();
      if (!sym || !isAuthenticated || !activeUid) return false;

      setTickerPending(sym, true);
      setFavoritesState((prev) => ({ ...prev, error: '' }));

      try {
        const response = await authFetch(
          `${API_BASE}/api/favorites/${encodeURIComponent(sym)}`,
          { method: 'DELETE' }
        );
        if (response.status === 401) {
          openSignInModal('Please sign in again to manage your Favorites.');
          return false;
        }
        if (!response.ok) {
          const msg = await extractErrorMessage(
            response,
            `Failed to remove ${sym} from favorites.`
          );
          throw new Error(msg);
        }

        setFavoritesState((prev) => ({
          uid: activeUid,
          items: (prev.uid === activeUid ? prev.items : []).filter((item) => item.ticker !== sym),
          error: '',
        }));
        return true;
      } catch (err) {
        setFavoritesState((prev) => ({
          ...prev,
          uid: activeUid,
          error: err?.message || `Failed to remove ${sym} from favorites.`,
        }));
        return false;
      } finally {
        setTickerPending(sym, false);
      }
    },
    [isAuthenticated, activeUid, authFetch, openSignInModal, setTickerPending]
  );

  const updateMarginOfSafety = useCallback(
    async (ticker, marginOfSafetyPrice) => {
      const sym = String(ticker || '').trim().toUpperCase();
      if (!sym) return null;

      if (!isAuthenticated || !activeUid) {
        openSignInModal(
          'Favorites are only available for signed-in users. Sign in to set your Margin of Safety buy price.'
        );
        return null;
      }

      setTickerPending(sym, true);
      setFavoritesState((prev) => ({ ...prev, error: '' }));

      try {
        const response = await authFetch(
          `${API_BASE}/api/favorites/${encodeURIComponent(sym)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              margin_of_safety_price: marginOfSafetyPrice,
            }),
          }
        );

        if (response.status === 401) {
          openSignInModal('Please sign in again to update your Margin of Safety price.');
          return null;
        }
        if (!response.ok) {
          const msg = await extractErrorMessage(
            response,
            `Failed to update Margin of Safety price for ${sym}.`
          );
          throw new Error(msg);
        }

        const updated = await response.json();
        setFavoritesState((prev) => ({
          uid: activeUid,
          items: (prev.uid === activeUid ? prev.items : []).map((item) =>
            item.ticker === updated.ticker ? updated : item
          ),
          error: '',
        }));
        return updated;
      } catch (err) {
        setFavoritesState((prev) => ({
          ...prev,
          uid: activeUid,
          error: err?.message || `Failed to update Margin of Safety price for ${sym}.`,
        }));
        return null;
      } finally {
        setTickerPending(sym, false);
      }
    },
    [isAuthenticated, activeUid, authFetch, openSignInModal, setTickerPending]
  );

  // Load favorites whenever a user signs in (no synchronous setState inside effect)
  useEffect(() => {
    if (!activeUid) return undefined;

    let cancelled = false;
    const pendingStock = pendingStarAfterSignInRef.current;
    pendingStarAfterSignInRef.current = null;

    (async () => {
      try {
        if (pendingStock) {
          const body = {
            name: pendingStock.name || pendingStock.ticker,
            industry: pendingStock.industry || undefined,
            last_known_price:
              pendingStock.last_known_price > 0
                ? Number(pendingStock.last_known_price)
                : undefined,
            model_mos_price:
              pendingStock.model_mos_price > 0
                ? Number(pendingStock.model_mos_price)
                : undefined,
          };
          await authFetch(
            `${API_BASE}/api/favorites/${encodeURIComponent(pendingStock.ticker)}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }
          );
        }

        const { items } = await requestFavorites(activeUid, { refreshQuotes: false });
        if (!cancelled) {
          setFavoritesState({ uid: activeUid, items, error: '' });
        }
      } catch (err) {
        if (!cancelled) {
          setFavoritesState({
            uid: activeUid,
            items: [],
            error: err?.message || 'Unable to load your favorites.',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeUid, authFetch, requestFavorites]);

  // Clear deferred star action if the sign-in modal is dismissed without signing in
  useEffect(() => {
    if (!signInModalOpen && !activeUid) {
      pendingStarAfterSignInRef.current = null;
    }
  }, [signInModalOpen, activeUid]);

  const favorites = useMemo(
    () => (activeUid && favoritesState.uid === activeUid ? favoritesState.items : []),
    [activeUid, favoritesState]
  );
  const loading = Boolean(activeUid) && favoritesState.uid !== activeUid;
  const error = activeUid && favoritesState.uid === activeUid ? favoritesState.error : '';

  const favoritesMap = useMemo(() => {
    const map = new Map();
    favorites.forEach((item) => {
      if (item?.ticker) {
        map.set(item.ticker.toUpperCase(), item);
      }
    });
    return map;
  }, [favorites]);

  const isFavorite = useCallback(
    (ticker) => {
      if (!ticker) return false;
      return favoritesMap.has(String(ticker).trim().toUpperCase());
    },
    [favoritesMap]
  );

  const getFavorite = useCallback(
    (ticker) => {
      if (!ticker) return null;
      return favoritesMap.get(String(ticker).trim().toUpperCase()) || null;
    },
    [favoritesMap]
  );

  const toggleFavorite = useCallback(
    async (stockMeta) => {
      const sym = String(stockMeta?.ticker || '').trim().toUpperCase();
      if (!sym) return { status: 'noop' };

      if (!isAuthenticated) {
        pendingStarAfterSignInRef.current = {
          ticker: sym,
          name: stockMeta?.name || sym,
          industry: stockMeta?.industry || '',
          last_known_price: stockMeta?.last_known_price ?? null,
          model_mos_price: stockMeta?.model_mos_price ?? null,
        };
        openSignInModal(
          `Favorites are only available for signed-in users. Sign in to add ${sym} to your Favorites list and track your Margin of Safety buy price.`
        );
        return { status: 'requires_auth' };
      }

      if (favoritesMap.has(sym)) {
        const removed = await removeFavorite(sym);
        return { status: removed ? 'removed' : 'error' };
      }

      const added = await addFavorite(stockMeta);
      return { status: added ? 'added' : 'error', item: added };
    },
    [isAuthenticated, favoritesMap, openSignInModal, removeFavorite, addFavorite]
  );

  const refreshFavorites = useCallback(
    async (opts = {}) => {
      if (!activeUid) return [];
      setRefreshing(true);
      setFavoritesState((prev) => ({ ...prev, error: '' }));
      try {
        const { items } = await requestFavorites(activeUid, {
          refreshQuotes: Boolean(opts.refreshQuotes),
        });
        setFavoritesState({ uid: activeUid, items, error: '' });
        return items;
      } catch (err) {
        setFavoritesState((prev) => ({
          ...prev,
          uid: activeUid,
          error: err?.message || 'Unable to refresh favorites.',
        }));
        return [];
      } finally {
        setRefreshing(false);
      }
    },
    [activeUid, requestFavorites]
  );

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        loading,
        refreshing,
        error,
        pendingTickers,
        isFavorite,
        getFavorite,
        refreshFavorites,
        addFavorite,
        removeFavorite,
        toggleFavorite,
        updateMarginOfSafety,
        clearError,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}
