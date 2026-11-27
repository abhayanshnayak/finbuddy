import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Home,
  Star,
  LineChart,
  Filter,
  Layers,
  FileText,
  Sun,
  Moon,
  CornerDownLeft,
  Sparkles,
  Clock,
  X,
  LogIn,
  LogOut,
} from 'lucide-react';
import { useCompanies } from '../../context/companiesStore';
import { useAuth } from '../../context/authStore';

function CommandPaletteDialog({ onClose, theme, toggleTheme }) {
  const navigate = useNavigate();
  const { companies, recentTickers } = useCompanies();
  const { user, openSignInModal, signOut } = useAuth();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(id);
  }, []);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [];

    // Direct symbol lookup when typing a ticker-like string
    if (q && /^[a-z0-9.-]{1,10}$/i.test(query.trim())) {
      const upper = query.trim().toUpperCase();
      const exists = companies.some((c) => c.ticker?.toUpperCase() === upper);
      if (!exists) {
        list.push({
          id: `fetch-${upper}`,
          group: 'Direct Analysis',
          title: `Analyze ${upper}`,
          subtitle: 'Fetch live report from Finnhub & AI engine',
          icon: Sparkles,
          badge: upper,
          action: () => navigate(`/ticker/${encodeURIComponent(upper)}`),
        });
      }
    }

    // Matching indexed companies (or recent tickers when empty)
    if (!q && recentTickers.length > 0) {
      recentTickers.slice(0, 4).forEach((r) => {
        list.push({
          id: `recent-${r.ticker}`,
          group: 'Recent Research',
          title: r.name || r.ticker,
          subtitle: 'Recently opened report',
          icon: Clock,
          badge: r.ticker,
          action: () => navigate(`/ticker/${encodeURIComponent(r.ticker)}`),
        });
      });
    }

    const companyMatches = companies
      .filter((c) => {
        if (!q) return true;
        return (
          (c.ticker || '').toLowerCase().includes(q) ||
          (c.name || '').toLowerCase().includes(q) ||
          (c.industry || '').toLowerCase().includes(q) ||
          (c.tags || []).some((t) => t.toLowerCase().includes(q))
        );
      })
      .slice(0, q ? 8 : 5);

    companyMatches.forEach((c) => {
      list.push({
        id: `co-${c.ticker}`,
        group: q ? 'Indexed Equities' : 'Indexed Coverage',
        title: c.name || c.ticker,
        subtitle: c.industry || 'Cached report',
        icon: LineChart,
        badge: c.ticker,
        action: () => navigate(`/ticker/${encodeURIComponent(c.ticker)}`),
      });
    });

    // Navigation & actions
    const navActions = [
      {
        id: 'nav-home',
        group: 'Navigation',
        title: 'Workspace Home',
        subtitle: 'Coverage overview & quick research launch',
        icon: Home,
        action: () => navigate('/'),
      },
      {
        id: 'nav-favorites',
        group: 'Navigation',
        title: 'Favorites Watchlist',
        subtitle: 'Track starred stocks, Margin of Safety prices & live deltas',
        icon: Star,
        action: () => navigate('/favorites'),
      },
      {
        id: 'nav-ticker',
        group: 'Navigation',
        title: 'Single Ticker Analysis',
        subtitle: '4-M valuation & equity research terminal',
        icon: LineChart,
        action: () => navigate('/ticker'),
      },
      {
        id: 'nav-screener',
        group: 'Navigation',
        title: 'Tag & Company Screener',
        subtitle: 'Filter and sort indexed companies by tags',
        icon: Filter,
        action: () => navigate('/screener'),
      },
      {
        id: 'nav-ingest',
        group: 'Navigation',
        title: 'Bulk Ingestion Pipeline',
        subtitle: 'Queue up to 500 tickers for batch ingestion',
        icon: Layers,
        action: () => navigate('/ingest'),
      },
      {
        id: 'nav-terms',
        group: 'Navigation',
        title: 'Terms of Service & Disclaimer',
        subtitle: 'Legal disclosures and data accuracy policy',
        icon: FileText,
        action: () => navigate('/terms'),
      },
      {
        id: 'act-theme',
        group: 'Preferences',
        title: theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme',
        subtitle: 'Toggle workspace color appearance',
        icon: theme === 'dark' ? Sun : Moon,
        action: () => toggleTheme(),
      },
      user
        ? {
            id: 'act-signout',
            group: 'Account',
            title: `Sign out (${user.displayName})`,
            subtitle: `Signed in via ${user.providerLabel}`,
            icon: LogOut,
            action: () => signOut(),
          }
        : {
            id: 'act-signin',
            group: 'Account',
            title: 'Sign in with Google or Facebook',
            subtitle: 'Sign in to save Favorites and track Margin of Safety prices',
            icon: LogIn,
            action: () => openSignInModal(),
          },
    ];

    navActions.forEach((act) => {
      if (
        !q ||
        act.title.toLowerCase().includes(q) ||
        act.subtitle.toLowerCase().includes(q)
      ) {
        list.push(act);
      }
    });

    return list;
  }, [query, companies, recentTickers, navigate, theme, toggleTheme, user, openSignInModal, signOut]);

  const runAction = (item) => {
    if (!item) return;
    onClose();
    item.action();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (items.length ? (prev + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        items.length ? (prev - 1 + items.length) % items.length : 0
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex]) {
        runAction(items[selectedIndex]);
      }
    }
  };

  // Group items preserving order
  const grouped = items.reduce((acc, item, globalIdx) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push({ ...item, globalIdx });
    return acc;
  }, {});

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global command palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-slate-950/60 backdrop-blur-sm no-print"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl bg-surface border border-line-strong rounded-xl shadow-2xl overflow-hidden animate-menuSlideIn">
        {/* Search Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
          <Search className="w-4 h-4 text-ink-muted flex-shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Jump to ticker, screen by tag, or run a command..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-ink placeholder:text-ink-muted"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close command palette"
            className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[55vh] overflow-y-auto py-2 custom-scrollbar">
          {items.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-muted">
              No matching tickers or commands found.
            </div>
          ) : (
            Object.entries(grouped).map(([groupName, groupItems]) => (
              <div key={groupName} className="mb-2 last:mb-0">
                <div className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  {groupName}
                </div>
                {groupItems.map((item) => {
                  const Icon = item.icon;
                  const active = item.globalIdx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setSelectedIndex(item.globalIdx)}
                      onClick={() => runAction(item)}
                      className={`w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                        active ? 'bg-brand-soft text-ink' : 'text-ink-secondary hover:bg-subtle'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={`w-4 h-4 flex-shrink-0 ${
                            active ? 'text-brand' : 'text-ink-muted'
                          }`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {item.badge && (
                              <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-subtle border border-line text-ink">
                                {item.badge}
                              </span>
                            )}
                            <span className="text-sm font-medium text-ink truncate">
                              {item.title}
                            </span>
                          </div>
                          <p className="text-xs text-ink-muted truncate">{item.subtitle}</p>
                        </div>
                      </div>
                      {active && (
                        <CornerDownLeft
                          className="w-3.5 h-3.5 text-brand flex-shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="px-4 py-2 bg-subtle border-t border-line flex items-center justify-between text-xs text-ink-muted">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
          <span className="font-mono text-[11px]">⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}

export default function CommandPalette({ open, onClose, theme, toggleTheme }) {
  if (!open) return null;
  return (
    <CommandPaletteDialog
      onClose={onClose}
      theme={theme}
      toggleTheme={toggleTheme}
    />
  );
}
