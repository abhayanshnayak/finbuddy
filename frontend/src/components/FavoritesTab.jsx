import { useState, useEffect, useMemo, useRef, useId } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Star,
  LogIn,
  RefreshCw,
  Search,
  X,
  Pencil,
  Check,
  Trash2,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Target,
  Sparkles,
  Filter,
  Loader2,
} from 'lucide-react';
import TickerSearchInput from './ui/TickerSearchInput';
import { useAuth } from '../context/authStore';
import {
  useFavorites,
  computeFavoriteDelta,
  parseMosPriceInput,
} from '../context/favoritesStore';
import { formatPrice } from '../utils/formatters';

const TEXT_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

function formatSignedDeltaCurrency(amount) {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—';
  const absFormatted = formatPrice(Math.abs(amount));
  if (Math.abs(amount) < 0.005) return '$0.00';
  return amount < 0 ? `−${absFormatted}` : `+${absFormatted}`;
}

function formatSignedPct(pct) {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return '—';
  if (Math.abs(pct) < 0.05) return '0.0%';
  const prefix = pct < 0 ? '−' : '+';
  return `${prefix}${Math.abs(pct).toFixed(1)}%`;
}

function FavoriteRow({
  favorite,
  isBusy,
  onSaveMos,
  onRemove,
  onAnnounce,
}) {
  const navigate = useNavigate();
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef(null);
  const editButtonRef = useRef(null);

  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState('');
  const [hasCommitted, setHasCommitted] = useState(false);
  const [validationError, setValidationError] = useState('');

  const ticker = favorite.ticker;
  const reportUrl = `/ticker/${encodeURIComponent(ticker)}`;
  const delta = computeFavoriteDelta(
    favorite.current_price,
    favorite.margin_of_safety_price
  );

  const startEditing = () => {
    setDraftValue(
      favorite.margin_of_safety_price > 0
        ? String(Number(favorite.margin_of_safety_price.toFixed(2)))
        : ''
    );
    setHasCommitted(false);
    setValidationError('');
    setEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const cancelEditing = () => {
    setEditing(false);
    setHasCommitted(false);
    setValidationError('');
    requestAnimationFrame(() => {
      editButtonRef.current?.focus();
    });
  };

  const handleDraftChange = (e) => {
    const nextVal = e.target.value;
    setDraftValue(nextVal);
    // Clear error immediately once the user corrects the input
    if (hasCommitted) {
      const check = parseMosPriceInput(nextVal);
      setValidationError(check.valid ? '' : check.error);
    }
  };

  const handleDraftBlur = () => {
    setHasCommitted(true);
    const check = parseMosPriceInput(draftValue);
    setValidationError(check.valid ? '' : check.error);
  };

  const handleSubmitMos = async (e) => {
    e.preventDefault();
    setHasCommitted(true);
    const check = parseMosPriceInput(draftValue);
    if (!check.valid) {
      setValidationError(check.error);
      inputRef.current?.focus();
      return;
    }

    const updated = await onSaveMos(ticker, check.value);
    if (updated) {
      setEditing(false);
      setHasCommitted(false);
      setValidationError('');
      onAnnounce(
        check.value !== null
          ? `Saved Margin of Safety buy price of ${formatPrice(check.value)} for ${ticker}.`
          : `Cleared Margin of Safety buy price for ${ticker}.`
      );
      requestAnimationFrame(() => {
        editButtonRef.current?.focus();
      });
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.nativeEvent?.isComposing) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    }
  };

  const handleRowClick = (e) => {
    if (editing) return;
    if (e.target.closest('a, button, input, form, label')) return;
    navigate(reportUrl);
  };

  const showError = Boolean(hasCommitted && validationError);

  return (
    <tr
      onClick={handleRowClick}
      className="hover:bg-subtle/60 transition-colors cursor-pointer group"
    >
      {/* 1. Stock Identity (Row Header with Native Link) */}
      <th scope="row" className="px-4 py-3.5 align-middle border-b border-line">
        <Link
          to={reportUrl}
          className="inline-flex items-center gap-3 min-w-0 group/link focus-visible:outline-none rounded-md"
        >
          <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-md bg-subtle border border-line text-ink group-hover:border-brand group-hover:text-brand group-focus-visible/link:ring-2 group-focus-visible/link:ring-brand transition-colors flex-shrink-0">
            {ticker}
          </span>
          <span className="min-w-0">
            <span className="font-semibold text-sm text-ink group-hover:text-brand transition-colors block truncate max-w-[240px]">
              {favorite.name || ticker}
            </span>
            {favorite.industry && favorite.industry !== 'Unknown' && (
              <span className="text-xs text-ink-muted block truncate max-w-[240px]">
                {favorite.industry}
              </span>
            )}
          </span>
        </Link>
      </th>

      {/* 2. Current Price */}
      <td className="px-4 py-3.5 align-middle whitespace-nowrap border-b border-line">
        <div className="sc-fav-cell-stack flex flex-col items-start">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm text-ink num">
              {favorite.current_price > 0 ? formatPrice(favorite.current_price) : '—'}
            </span>
            {favorite.day_change_pct !== null &&
              favorite.day_change_pct !== undefined &&
              Number.isFinite(favorite.day_change_pct) && (
                <span
                  className={`font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded num ${
                    favorite.day_change_pct >= 0
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {formatSignedPct(favorite.day_change_pct)}
                </span>
              )}
          </div>
          {favorite.price_source && (
            <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted mt-0.5">
              <span
                aria-hidden="true"
                className={`w-1.5 h-1.5 rounded-full ${
                  favorite.price_source === 'live' ? 'bg-emerald-500' : 'bg-ink-muted/60'
                }`}
              />
              <span>{favorite.price_source === 'live' ? 'Live quote' : 'Cached price'}</span>
            </span>
          )}
        </div>
      </td>

      {/* 3. User's Margin of Safety Buy Price (Inline Editor) */}
      <td
        className="px-4 py-3.5 align-middle border-b border-line"
        onClick={(e) => e.stopPropagation()}
      >
        {editing ? (
          <form onSubmit={handleSubmitMos} noValidate className="space-y-1.5 min-w-[210px]">
            <label htmlFor={inputId} className="visually-hidden">
              Margin of Safety buy price for {ticker} in USD
            </label>
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1 min-w-[110px]">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-ink-muted"
                >
                  $
                </span>
                <input
                  ref={inputRef}
                  id={inputId}
                  name={`mos_${ticker}`}
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="done"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={draftValue}
                  onChange={handleDraftChange}
                  onBlur={handleDraftBlur}
                  onKeyDown={handleInputKeyDown}
                  aria-invalid={showError ? 'true' : 'false'}
                  aria-describedby={showError ? errorId : undefined}
                  placeholder="e.g. 145.50"
                  className="sc-mos-input w-full pl-6 pr-2.5 py-1.5 min-h-[34px] rounded-lg bg-canvas border border-line-strong focus:border-brand text-sm font-mono text-ink num outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isBusy}
                aria-label={`Save Margin of Safety price for ${ticker}`}
                title="Save MOS buy price"
                className="inline-flex items-center justify-center min-w-[34px] min-h-[34px] rounded-lg bg-brand hover:bg-brand-hover text-white transition-colors cursor-pointer disabled:opacity-60"
              >
                {isBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="w-4 h-4" aria-hidden="true" />
                )}
              </button>

              <button
                type="button"
                onClick={cancelEditing}
                disabled={isBusy}
                aria-label={`Cancel editing Margin of Safety price for ${ticker}`}
                title="Cancel"
                className="inline-flex items-center justify-center min-w-[34px] min-h-[34px] rounded-lg bg-subtle hover:bg-line text-ink-secondary hover:text-ink border border-line transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {showError && (
              <p
                id={errorId}
                className="flex items-start gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 text-left"
              >
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>{validationError}</span>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {favorite.model_mos_price > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftValue(String(Number(favorite.model_mos_price.toFixed(2))));
                    setValidationError('');
                    inputRef.current?.focus();
                  }}
                  className="font-medium text-brand hover:underline cursor-pointer"
                >
                  Use report MOS ({formatPrice(favorite.model_mos_price)})
                </button>
              )}
              {favorite.margin_of_safety_price > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftValue('');
                    setValidationError('');
                    inputRef.current?.focus();
                  }}
                  className="font-medium text-ink-muted hover:text-rose-600 dark:hover:text-rose-400 hover:underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </form>
        ) : (
          <div className="sc-fav-cell-stack flex flex-col items-start gap-0.5">
            <div className="inline-flex items-center gap-2">
              {favorite.margin_of_safety_price > 0 ? (
                <>
                  <span className="font-mono font-bold text-sm text-ink num">
                    {formatPrice(favorite.margin_of_safety_price)}
                  </span>
                  <button
                    ref={editButtonRef}
                    type="button"
                    onClick={startEditing}
                    disabled={isBusy}
                    aria-label={`Edit Margin of Safety price for ${ticker}`}
                    title="Edit Margin of Safety buy price"
                    className="inline-flex items-center justify-center min-w-[28px] min-h-[28px] px-1.5 rounded-md text-ink-muted hover:text-brand hover:bg-brand-soft border border-transparent hover:border-brand/25 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </>
              ) : (
                <button
                  ref={editButtonRef}
                  type="button"
                  onClick={startEditing}
                  disabled={isBusy}
                  aria-label={`Add Margin of Safety buy price for ${ticker}`}
                  className="inline-flex items-center gap-1.5 min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold bg-brand-soft hover:bg-brand/15 text-brand border border-brand/25 transition-colors cursor-pointer"
                >
                  <Target className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add MOS price</span>
                </button>
              )}
            </div>

            {favorite.model_mos_price > 0 && (
              <span className="text-[11px] text-ink-muted font-mono num">
                Report MOS: {formatPrice(favorite.model_mos_price)}
              </span>
            )}
          </div>
        )}
      </td>

      {/* 4. Delta (Current Price vs. User's MOS Buy Price) */}
      <td className="px-4 py-3.5 align-middle whitespace-nowrap border-b border-line">
        {delta ? (
          <div className="sc-fav-cell-stack flex flex-col items-start gap-1">
            <div className="inline-flex items-center gap-1.5 font-mono text-sm font-bold num">
              <span
                className={
                  delta.isInBuyZone
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }
              >
                {formatSignedDeltaCurrency(delta.amount)}
              </span>
              <span
                className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                  delta.isInBuyZone
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                }`}
              >
                {formatSignedPct(delta.pct)}
              </span>
            </div>

            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                delta.isInBuyZone
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-ink-muted'
              }`}
            >
              {delta.isInBuyZone ? (
                <>
                  <CheckCircle2 className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                  <span>
                    {delta.isAtTarget
                      ? 'At buy price'
                      : `Buy zone · ${Math.abs(delta.pct).toFixed(1)}% below`}
                  </span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                  <span>{Math.abs(delta.pct).toFixed(1)}% above buy price</span>
                </>
              )}
            </span>
          </div>
        ) : (
          <span className="text-xs text-ink-muted">
            {favorite.margin_of_safety_price > 0
              ? 'Price unavailable'
              : 'Set MOS to view delta'}
          </span>
        )}
      </td>

      {/* 5. Row Actions */}
      <td
        className="px-4 py-3.5 align-middle whitespace-nowrap text-right border-b border-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="inline-flex items-center justify-end gap-2">
          <Link
            to={reportUrl}
            aria-label={`Open ${ticker} equity report`}
            className="inline-flex items-center gap-1 min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold text-brand hover:bg-brand-soft transition-colors"
          >
            <span>Report</span>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>

          <button
            type="button"
            disabled={isBusy}
            onClick={async () => {
              const ok = await onRemove(ticker);
              if (ok) {
                onAnnounce(`${ticker} removed from Favorites.`);
              }
            }}
            aria-label={`Remove ${ticker} from favorites`}
            title={`Remove ${ticker} from Favorites`}
            className="inline-flex items-center justify-center min-w-[32px] min-h-[32px] rounded-lg text-ink-muted hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isBusy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function FavoritesTab() {
  const navigate = useNavigate();
  const captionId = useId();
  const filterSearchId = useId();

  const { isAuthenticated, loading: authLoading, openSignInModal } = useAuth();
  const {
    favorites,
    loading,
    refreshing,
    error,
    pendingTickers,
    refreshFavorites,
    updateMarginOfSafety,
    removeFavorite,
    clearError,
  } = useFavorites();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'buy_zone' | 'needs_mos'
  const [sortField, setSortField] = useState('added_at'); // 'added_at' | 'ticker' | 'current_price' | 'margin_of_safety_price' | 'delta_pct'
  const [sortDir, setSortDir] = useState('desc');
  const [statusAnnouncement, setStatusAnnouncement] = useState('');

  useEffect(() => {
    document.title = 'Favorites Watchlist — StockClue';
  }, []);

  // Compute summary metrics across all favorites
  const summary = useMemo(() => {
    let inBuyZoneCount = 0;
    let targetsSetCount = 0;
    let closestStock = null;

    favorites.forEach((fav) => {
      if (fav.margin_of_safety_price > 0) {
        targetsSetCount += 1;
      }
      const delta = computeFavoriteDelta(fav.current_price, fav.margin_of_safety_price);
      if (delta) {
        if (delta.isInBuyZone) {
          inBuyZoneCount += 1;
        }
        if (!closestStock || delta.pct < closestStock.delta.pct) {
          closestStock = { favorite: fav, delta };
        }
      }
    });

    return {
      total: favorites.length,
      inBuyZoneCount,
      targetsSetCount,
      needsMosCount: favorites.length - targetsSetCount,
      closestStock,
    };
  }, [favorites]);

  // Filter & sort favorites cleanly
  const displayedFavorites = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = favorites.filter((fav) => {
      if (filterMode === 'buy_zone') {
        const delta = computeFavoriteDelta(fav.current_price, fav.margin_of_safety_price);
        if (!delta || !delta.isInBuyZone) return false;
      } else if (filterMode === 'needs_mos') {
        if (fav.margin_of_safety_price > 0) return false;
      }

      if (q) {
        const ticker = (fav.ticker || '').toLowerCase();
        const name = (fav.name || '').toLowerCase();
        const industry = (fav.industry || '').toLowerCase();
        if (!ticker.includes(q) && !name.includes(q) && !industry.includes(q)) {
          return false;
        }
      }
      return true;
    });

    const factor = sortDir === 'asc' ? 1 : -1;
    const getNumericVal = (fav, field) => {
      if (field === 'delta_pct') {
        const delta = computeFavoriteDelta(fav.current_price, fav.margin_of_safety_price);
        return delta ? delta.pct : null;
      }
      const raw = fav[field];
      return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
    };

    return [...filtered].sort((a, b) => {
      if (sortField === 'ticker') {
        return factor * TEXT_COLLATOR.compare(a.ticker || '', b.ticker || '');
      }
      if (sortField === 'added_at') {
        return factor * TEXT_COLLATOR.compare(a.added_at || '', b.added_at || '');
      }

      const numA = getNumericVal(a, sortField);
      const numB = getNumericVal(b, sortField);
      if (numA === null && numB === null) {
        return TEXT_COLLATOR.compare(a.ticker || '', b.ticker || '');
      }
      if (numA === null) return 1;
      if (numB === null) return -1;
      return factor * (numA - numB);
    });
  }, [favorites, searchQuery, filterMode, sortField, sortDir]);

  const handleSort = (field, label) => {
    const nextDir = sortField === field ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
    setSortField(field);
    setSortDir(nextDir);
    const dirWord = nextDir === 'asc' ? 'ascending' : 'descending';
    setStatusAnnouncement(
      `Sorted by ${label}, ${dirWord}, ${displayedFavorites.length} rows.`
    );
  };

  const getAriaSort = (field) => {
    if (sortField !== field) return undefined;
    return sortDir === 'asc' ? 'ascending' : 'descending';
  };

  // Auth initializing skeleton
  if (authLoading) {
    return (
      <div className="space-y-4 animate-pulse py-4" aria-busy="true" aria-label="Checking sign-in status">
        <div className="h-28 rounded-xl bg-surface border border-line" />
        <div className="h-64 rounded-xl bg-surface border border-line" />
      </div>
    );
  }

  // Signed-out gate: explicitly mention Favorites are for signed-in users & let them sign in
  if (!isAuthenticated) {
    return (
      <div className="max-w-3xl mx-auto py-8 space-y-6 animate-fadeIn">
        <section className="bg-surface border border-line rounded-2xl p-6 sm:p-10 text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto">
            <Star className="w-7 h-7 fill-amber-400/80" aria-hidden="true" />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              Favorites Watchlist
            </h1>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              Favorites are only available for signed-in users.
            </p>
            <p className="text-sm text-ink-secondary leading-relaxed">
              Sign in with Google or Facebook to star stocks on any equity report, save your
              personal Margin of Safety buy price, and monitor live market prices and buy-zone
              deltas.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() =>
                openSignInModal(
                  'Favorites are only available for signed-in users. Sign in with Google or Facebook to save favorite stocks and track your Margin of Safety buy prices.'
                )
              }
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <LogIn className="w-4 h-4" aria-hidden="true" />
              <span>Sign in to use Favorites</span>
            </button>

            <Link
              to="/ticker"
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-xl bg-subtle hover:bg-line/70 text-ink-secondary hover:text-ink border border-line text-sm font-semibold transition-colors"
            >
              <span>Browse Stock Reports</span>
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-line text-left">
            <div className="rounded-xl bg-subtle/60 border border-line p-4 space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
                <Star className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                <span>Star Any Stock</span>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                Bookmark equities straight from the header of any per-stock research report.
              </p>
            </div>
            <div className="rounded-xl bg-subtle/60 border border-line p-4 space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
                <Target className="w-3.5 h-3.5 text-brand" aria-hidden="true" />
                <span>Set Your MOS Price</span>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                Record the exact Margin of Safety price you are willing to pay for each company.
              </p>
            </div>
            <div className="rounded-xl bg-subtle/60 border border-line p-4 space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
                <TrendingDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span>Live Price &amp; Delta</span>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                Compare live market prices against your buy target to spot opportunities fast.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Screen-reader polite status region */}
      <div role="status" aria-live="polite" className="visually-hidden">
        {statusAnnouncement}
      </div>

      {/* Header */}
      <section className="bg-surface border border-line rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-ink flex items-center gap-2.5 tracking-tight">
              <Star className="w-5 h-5 fill-amber-400 text-amber-500 flex-shrink-0" aria-hidden="true" />
              <span>Favorites Watchlist</span>
            </h1>
            <p className="text-xs sm:text-sm text-ink-muted mt-1">
              Set your personal Margin of Safety buy price for each starred equity and compare
              against live market prices. Click any stock to open its full report.
            </p>
          </div>

          <button
            type="button"
            onClick={async () => {
              await refreshFavorites({ refreshQuotes: true });
              setStatusAnnouncement('Refreshed live stock prices for Favorites.');
            }}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-surface hover:bg-subtle text-ink-secondary hover:text-ink border border-line-strong transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading || refreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Prices'}</span>
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-center justify-between gap-3 bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/25 rounded-lg px-4 py-3 text-xs font-semibold"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={clearError}
              aria-label="Dismiss error"
              className="p-1 rounded hover:bg-rose-500/15 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </section>

      {/* KPI Summary Strip */}
      {!loading && favorites.length > 0 && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface border border-line rounded-xl p-4">
            <div className="flex items-center justify-between text-ink-muted mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider">Saved Stocks</span>
              <Star className="w-4 h-4 text-amber-500" aria-hidden="true" />
            </div>
            <p className="text-2xl font-bold font-mono text-ink num">{summary.total}</p>
            <p className="text-xs text-ink-muted mt-0.5">Tracked in your watchlist</p>
          </div>

          <div className="bg-surface border border-line rounded-xl p-4">
            <div className="flex items-center justify-between text-ink-muted mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider">In Buy Zone</span>
              <CheckCircle2
                className={`w-4 h-4 ${
                  summary.inBuyZoneCount > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-ink-muted'
                }`}
                aria-hidden="true"
              />
            </div>
            <p
              className={`text-2xl font-bold font-mono num ${
                summary.inBuyZoneCount > 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-ink'
              }`}
            >
              {summary.inBuyZoneCount}
            </p>
            <p className="text-xs text-ink-muted mt-0.5">At or below your MOS price</p>
          </div>

          <div className="bg-surface border border-line rounded-xl p-4">
            <div className="flex items-center justify-between text-ink-muted mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider">Targets Set</span>
              <Target className="w-4 h-4 text-brand" aria-hidden="true" />
            </div>
            <p className="text-2xl font-bold font-mono text-ink num">
              {summary.targetsSetCount}
              <span className="text-sm font-normal text-ink-muted"> / {summary.total}</span>
            </p>
            <p className="text-xs text-ink-muted mt-0.5">
              {summary.needsMosCount === 0
                ? 'All favorites have a buy price'
                : `${summary.needsMosCount} awaiting MOS target`}
            </p>
          </div>

          <div className="bg-surface border border-line rounded-xl p-4">
            <div className="flex items-center justify-between text-ink-muted mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider">Best Value Delta</span>
              <Sparkles className="w-4 h-4 text-brand" aria-hidden="true" />
            </div>
            {summary.closestStock ? (
              <>
                <Link
                  to={`/ticker/${encodeURIComponent(summary.closestStock.favorite.ticker)}`}
                  className="inline-flex items-baseline gap-2 group"
                >
                  <span className="text-2xl font-bold font-mono text-brand group-hover:underline">
                    {summary.closestStock.favorite.ticker}
                  </span>
                  <span
                    className={`text-sm font-mono font-bold num ${
                      summary.closestStock.delta.isInBuyZone
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {formatSignedPct(summary.closestStock.delta.pct)}
                  </span>
                </Link>
                <p className="text-xs text-ink-muted mt-0.5 truncate">
                  {summary.closestStock.delta.isInBuyZone
                    ? 'Trading inside buy zone'
                    : 'Closest to your buy target'}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold font-mono text-ink-muted">—</p>
                <p className="text-xs text-ink-muted mt-0.5">Add a MOS buy price to compare</p>
              </>
            )}
          </div>
        </section>
      )}

      {/* Main Watchlist Content */}
      {loading ? (
        <div
          className="bg-surface border border-line rounded-xl p-6 space-y-3 animate-pulse"
          aria-busy="true"
          aria-label="Loading your favorite stocks"
        >
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-12 bg-subtle rounded-lg" />
          ))}
        </div>
      ) : favorites.length === 0 ? (
        <section className="bg-surface border border-line rounded-xl p-8 sm:p-10 text-center space-y-5">
          <div className="w-12 h-12 rounded-xl bg-subtle border border-line text-ink-muted flex items-center justify-center mx-auto">
            <Star className="w-6 h-6" aria-hidden="true" />
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-lg font-bold text-ink">No favorite stocks yet</h2>
            <p className="text-sm text-ink-secondary leading-relaxed">
              Open any stock report and click the <strong className="text-ink">★ Favorite</strong>{' '}
              star in the company header to add it here and track your Margin of Safety buy price.
            </p>
          </div>

          <div className="max-w-md mx-auto pt-1 text-left">
            <TickerSearchInput
              onSelectTicker={(sym) => navigate(`/ticker/${encodeURIComponent(sym)}`)}
              placeholder="Search a ticker to open its report (e.g., AAPL, MSFT)..."
              size="md"
            />
          </div>

          <div className="pt-2">
            <Link
              to="/screener"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
            >
              <Filter className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Or browse all indexed companies in Tag Screener</span>
            </Link>
          </div>
        </section>
      ) : (
        <section className="bg-surface border border-line rounded-xl overflow-hidden">
          {/* Search & Quick Filter Toolbar */}
          <search className="p-4 border-b border-line flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <label htmlFor={filterSearchId} className="visually-hidden">
                Filter favorite stocks by ticker, company name, or industry
              </label>
              <Search
                className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id={filterSearchId}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Filter favorites by ticker, company, or industry..."
                className="w-full pl-9 pr-8 py-2 bg-canvas border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 rounded-lg text-sm text-ink placeholder:text-ink-muted outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear favorites filter"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: 'All', count: summary.total },
                { id: 'buy_zone', label: 'In Buy Zone', count: summary.inBuyZoneCount },
                { id: 'needs_mos', label: 'Needs MOS', count: summary.needsMosCount },
              ].map((tab) => {
                const active = filterMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilterMode(tab.id)}
                    className={`inline-flex items-center gap-1.5 min-h-[32px] px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      active
                        ? 'bg-brand-soft text-brand border-brand/30'
                        : 'bg-surface hover:bg-subtle text-ink-secondary hover:text-ink border-line'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="font-mono text-[11px] num opacity-80">{tab.count}</span>
                  </button>
                );
              })}
            </div>
          </search>

          {/* Responsive & Keyboard-Scrollable Data Table */}
          {displayedFavorites.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2">
              <p className="text-sm font-semibold text-ink-secondary">
                No favorite stocks match your current filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterMode('all');
                }}
                className="text-xs font-semibold text-brand hover:underline cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-labelledby={captionId}
              className="sc-favorites-table-wrapper custom-scrollbar"
            >
              <table className="sc-favorites-table text-sm text-left">
                <caption id={captionId} className="visually-hidden">
                  Favorite stocks watchlist with current price, your Margin of Safety buy price,
                  and price delta
                </caption>
                <thead className="bg-subtle/90 text-xs font-semibold text-ink-muted uppercase tracking-wider">
                  <tr>
                    {[
                      { field: 'ticker', label: 'Stock' },
                      { field: 'current_price', label: 'Current Price' },
                      { field: 'margin_of_safety_price', label: 'Your MOS Buy Price' },
                      { field: 'delta_pct', label: 'Delta vs. MOS' },
                    ].map((col) => (
                      <th
                        key={col.field}
                        scope="col"
                        aria-sort={getAriaSort(col.field)}
                        className="border-b border-line"
                      >
                        <button
                          type="button"
                          onClick={() => handleSort(col.field, col.label)}
                          className="w-full min-h-[40px] px-4 py-3 inline-flex items-center gap-1.5 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted hover:text-ink transition-colors cursor-pointer"
                        >
                          <span>{col.label}</span>
                          <span aria-hidden="true" className="sc-sort-indicator-neutral opacity-45">
                            <ArrowUpDown className="w-3.5 h-3.5" />
                          </span>
                          <span aria-hidden="true" className="sc-sort-indicator-asc text-brand">
                            <ArrowUp className="w-3.5 h-3.5" />
                          </span>
                          <span aria-hidden="true" className="sc-sort-indicator-desc text-brand">
                            <ArrowDown className="w-3.5 h-3.5" />
                          </span>
                        </button>
                      </th>
                    ))}
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted border-b border-line"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {displayedFavorites.map((fav) => (
                    <FavoriteRow
                      key={fav.ticker}
                      favorite={fav}
                      isBusy={pendingTickers.has(fav.ticker)}
                      onSaveMos={updateMarginOfSafety}
                      onRemove={removeFavorite}
                      onAnnounce={setStatusAnnouncement}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
