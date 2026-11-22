import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ArrowRight, Database, Sparkles } from 'lucide-react';
import { useCompanies } from '../../context/companiesStore';

/**
 * Typeahead ticker search input backed by indexed /api/companies records,
 * with keyboard navigation (ArrowUp/ArrowDown/Enter/Escape) and support for arbitrary symbols.
 */
export default function TickerSearchInput({
  onSelectTicker,
  initialValue = '',
  placeholder = 'Search ticker symbol or company name (e.g., AAPL, NVDA, Microsoft)...',
  autoFocus = false,
  size = 'md',
}) {
  const { companies } = useCompanies();
  const [query, setQuery] = useState(initialValue);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const trimmed = query.trim();
  const normalizedSymbol = trimmed.toUpperCase();

  const matches = useMemo(() => {
    if (!trimmed) return companies.slice(0, 6);
    const q = trimmed.toLowerCase();
    return companies
      .filter((c) => {
        const t = (c.ticker || '').toLowerCase();
        const n = (c.name || '').toLowerCase();
        const ind = (c.industry || '').toLowerCase();
        return t.includes(q) || n.includes(q) || ind.includes(q);
      })
      .sort((a, b) => {
        const aStarts = (a.ticker || '').toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = (b.ticker || '').toLowerCase().startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return (a.ticker || '').localeCompare(b.ticker || '');
      })
      .slice(0, 7);
  }, [companies, trimmed]);

  const exactMatchExists = matches.some((m) => m.ticker?.toUpperCase() === normalizedSymbol);
  const showDirectLookup =
    trimmed.length >= 1 && /^[A-Za-z0-9.-]{1,10}$/.test(trimmed) && !exactMatchExists;

  const totalOptions = matches.length + (showDirectLookup ? 1 : 0);

  const commitTicker = (sym) => {
    if (!sym) return;
    const clean = sym.trim().toUpperCase();
    setIsOpen(false);
    setQuery(clean);
    onSelectTicker(clean);
  };

  const handleKeyDown = (e) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((prev) => (totalOptions > 0 ? (prev + 1) % totalOptions : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((prev) =>
        totalOptions > 0 ? (prev - 1 + totalOptions) % totalOptions : 0
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && totalOptions > 0) {
        if (highlightIdx < matches.length) {
          commitTicker(matches[highlightIdx].ticker);
        } else if (showDirectLookup) {
          commitTicker(normalizedSymbol);
        }
      } else if (trimmed) {
        commitTicker(normalizedSymbol);
      }
    }
  };

  const isLarge = size === 'lg';

  return (
    <div ref={wrapperRef} className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed) commitTicker(normalizedSymbol);
        }}
        className={`flex items-center bg-surface border border-line-strong focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all ${
          isLarge ? 'rounded-xl pl-4 pr-2 py-2 shadow-sm' : 'rounded-lg pl-3 pr-1.5 py-1.5'
        }`}
      >
        <Search
          className={`${isLarge ? 'w-5 h-5' : 'w-4 h-4'} text-ink-muted flex-shrink-0`}
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          autoFocus={autoFocus}
          onFocus={() => {
            setIsOpen(true);
            setHighlightIdx(0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlightIdx(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Search stock ticker or company name"
          aria-expanded={isOpen && totalOptions > 0}
          role="combobox"
          aria-autocomplete="list"
          className={`flex-1 bg-transparent border-none outline-none text-ink placeholder:text-ink-muted font-medium ${
            isLarge ? 'px-3 py-1 text-base' : 'px-2.5 py-0.5 text-sm'
          }`}
        />
        <button
          type="submit"
          disabled={!trimmed}
          className={`inline-flex items-center gap-1.5 bg-brand hover:bg-brand-hover text-white font-semibold rounded-lg transition-colors disabled:opacity-40 cursor-pointer ${
            isLarge ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs'
          }`}
        >
          <span>Analyze</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </form>

      {isOpen && totalOptions > 0 && (
        <div
          role="listbox"
          className="absolute left-0 right-0 mt-1.5 bg-surface border border-line-strong rounded-xl shadow-xl z-40 overflow-hidden animate-menuSlideIn"
        >
          <div className="px-3 py-1.5 bg-subtle border-b border-line flex items-center justify-between text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
            <span>{trimmed ? 'Matching Indexed Tickers' : 'Indexed Companies'}</span>
            <span>Enter to select</span>
          </div>
          <ul className="max-h-72 overflow-y-auto divide-y divide-line custom-scrollbar">
            {matches.map((item, idx) => (
              <li key={item.ticker} role="option" aria-selected={idx === highlightIdx}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlightIdx(idx)}
                  onClick={() => commitTicker(item.ticker)}
                  className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                    idx === highlightIdx ? 'bg-brand-soft' : 'hover:bg-subtle'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-subtle border border-line text-ink flex-shrink-0">
                      {item.ticker}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{item.name}</p>
                      <p className="text-xs text-ink-muted truncate">
                        {item.industry || 'Equity'}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs text-ink-muted flex-shrink-0">
                    <Database className="w-3 h-3" aria-hidden="true" />
                    <span>Cached</span>
                  </span>
                </button>
              </li>
            ))}

            {showDirectLookup && (
              <li role="option" aria-selected={highlightIdx === matches.length}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlightIdx(matches.length)}
                  onClick={() => commitTicker(normalizedSymbol)}
                  className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                    highlightIdx === matches.length ? 'bg-brand-soft' : 'hover:bg-subtle'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-brand text-white flex-shrink-0">
                      {normalizedSymbol}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        Fetch &amp; analyze &ldquo;{normalizedSymbol}&rdquo;
                      </p>
                      <p className="text-xs text-ink-muted">
                        Runs live Finnhub financials + SEC XBRL + AI synthesis
                      </p>
                    </div>
                  </div>
                  <Sparkles className="w-4 h-4 text-brand flex-shrink-0" aria-hidden="true" />
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
