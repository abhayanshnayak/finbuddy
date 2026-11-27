import { createContext, useContext } from 'react';

export const FavoritesContext = createContext({
  favorites: [],
  loading: false,
  refreshing: false,
  error: '',
  pendingTickers: new Set(),
  isFavorite: () => false,
  getFavorite: () => null,
  refreshFavorites: async () => {},
  addFavorite: async () => null,
  removeFavorite: async () => false,
  toggleFavorite: async () => ({ status: 'noop' }),
  updateMarginOfSafety: async () => null,
  clearError: () => {},
});

export function useFavorites() {
  return useContext(FavoritesContext);
}

/**
 * Computes the delta between the current market price and the user's
 * personal Margin of Safety (MOS) buy price.
 *
 * amount = currentPrice - mosPrice
 * pct    = ((currentPrice - mosPrice) / mosPrice) * 100
 *
 * Negative or zero delta means the stock is trading at or below the user's buy price (Buy Zone).
 */
export function computeFavoriteDelta(currentPrice, mosPrice) {
  const curr = Number(currentPrice);
  const mos = Number(mosPrice);
  if (!Number.isFinite(curr) || !Number.isFinite(mos) || curr <= 0 || mos <= 0) {
    return null;
  }

  const amount = curr - mos;
  const pct = (amount / mos) * 100;
  const isInBuyZone = curr <= mos;
  const isAtTarget = isInBuyZone && Math.abs(amount) < 0.005;

  return {
    amount,
    pct,
    isInBuyZone,
    isAtTarget,
  };
}

/**
 * Parses and validates user input for Margin of Safety buy price.
 * Blank input clears the saved price (value: null).
 */
export function parseMosPriceInput(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) {
    return { valid: true, value: null, error: '' };
  }

  const normalized = trimmed.replace(/^\$\s*/, '').replace(/,/g, '');
  if (!/^(?:\d+(?:\.\d{1,4})?|\.\d{1,4})$/.test(normalized)) {
    return {
      valid: false,
      value: null,
      error: 'Enter a positive dollar price (e.g., 145.50), or leave blank to clear.',
    };
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1_000_000_000) {
    return {
      valid: false,
      value: null,
      error: 'Enter a price greater than $0.00.',
    };
  }

  return {
    valid: true,
    value: Number(parsed.toFixed(4)),
    error: '',
  };
}
