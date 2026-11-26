import { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import {
  Home,
  LineChart,
  Filter,
  Layers,
  FileText,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  TrendingUp,
} from 'lucide-react';
import ThemeToggle from './ui/ThemeToggle';
import CommandPalette from './ui/CommandPalette';
import SidebarUserSection from './auth/SidebarUserSection';
import { useCompanies } from '../context/companiesStore';

const NAV_ITEMS = [
  { to: '/', label: 'Workspace Home', icon: Home, end: true },
  { to: '/ticker', label: 'Ticker Research', icon: LineChart, end: false },
  { to: '/screener', label: 'Tag Screener', icon: Filter, end: false },
  { to: '/ingest', label: 'Bulk Pipeline', icon: Layers, end: false },
];

export default function AppShell({ theme, toggleTheme, children }) {
  const location = useLocation();
  const { companies } = useCompanies();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('stockclue_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Persist sidebar preference
  useEffect(() => {
    try {
      localStorage.setItem('stockclue_sidebar_collapsed', String(sidebarCollapsed));
    } catch {
      // Ignore storage errors
    }
  }, [sidebarCollapsed]);

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Derive breadcrumb label
  const path = location.pathname;
  const tickerMatch = path.match(/^\/ticker\/([^/]+)/);
  const activeSymbol = tickerMatch ? decodeURIComponent(tickerMatch[1]).toUpperCase() : null;

  let sectionTitle = 'Workspace Home';
  if (path.startsWith('/ticker')) sectionTitle = 'Ticker Research';
  else if (path.startsWith('/screener')) sectionTitle = 'Tag Screener';
  else if (path.startsWith('/ingest')) sectionTitle = 'Bulk Pipeline';
  else if (path.startsWith('/terms')) sectionTitle = 'Terms & Disclaimer';

  return (
    <div className="min-h-screen bg-canvas text-ink flex transition-colors duration-200">
      {/* Desktop Persistent Sidebar */}
      <aside
        aria-label="Primary navigation"
        className={`hidden lg:flex flex-col flex-shrink-0 bg-surface border-r border-line sticky top-0 h-screen transition-[width] duration-200 no-print ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Brand Header */}
        <div className="h-14 px-3.5 border-b border-line flex items-center justify-between gap-2">
          <Link
            to="/"
            className="flex items-center gap-2.5 min-w-0 group"
            title="StockClue Home"
          >
            <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center flex-shrink-0 shadow-sm">
              <TrendingUp className="w-4 h-4 text-white" strokeWidth={2.5} aria-hidden="true" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <span className="text-base font-bold tracking-tight text-ink block leading-none">
                  StockClue
                </span>
                <span className="text-[11px] text-ink-muted font-medium block mt-0.5 truncate">
                  Equity Research
                </span>
              </div>
            )}
          </Link>

          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto custom-scrollbar">
          {sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="w-full flex items-center justify-center p-2 mb-2 rounded-lg text-ink-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={sidebarCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg text-sm font-medium transition-colors ${
                    sidebarCollapsed ? 'justify-center p-2.5' : 'px-3 py-2'
                  } ${
                    isActive
                      ? 'bg-brand-soft text-brand font-semibold'
                      : 'text-ink-secondary hover:bg-subtle hover:text-ink'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                {!sidebarCollapsed && (
                  <span className="truncate flex-1">{item.label}</span>
                )}
                {!sidebarCollapsed && item.to === '/screener' && companies.length > 0 && (
                  <span className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded bg-subtle text-ink-muted border border-line num">
                    {companies.length}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer: Account & Legal */}
        <div className="p-2.5 border-t border-line space-y-2">
          <SidebarUserSection collapsed={sidebarCollapsed} />
          <div className="pt-1 border-t border-line/70">
            <NavLink
              to="/terms"
              title={sidebarCollapsed ? 'Terms & Disclaimer' : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg text-xs font-medium transition-colors ${
                  sidebarCollapsed ? 'justify-center p-2.5' : 'px-3 py-2'
                } ${
                  isActive
                    ? 'bg-brand-soft text-brand font-semibold'
                    : 'text-ink-muted hover:bg-subtle hover:text-ink'
                }`
              }
            >
              <FileText className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              {!sidebarCollapsed && <span className="truncate">Terms &amp; Disclaimer</span>}
            </NavLink>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex bg-slate-950/60 backdrop-blur-sm no-print"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMobileNavOpen(false);
          }}
        >
          <aside className="w-64 bg-surface border-r border-line h-full flex flex-col shadow-2xl">
            <div className="h-14 px-4 border-b border-line flex items-center justify-between">
              <Link to="/" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-base font-bold tracking-tight text-ink">StockClue</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation menu"
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-subtle cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileNavOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-brand-soft text-brand font-semibold'
                          : 'text-ink-secondary hover:bg-subtle hover:text-ink'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.to === '/screener' && companies.length > 0 && (
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-subtle text-ink-muted border border-line num">
                        {companies.length}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
            <div className="p-3 border-t border-line space-y-2">
              <SidebarUserSection collapsed={false} onAction={() => setMobileNavOpen(false)} />
              <div className="pt-1 border-t border-line/70">
                <NavLink
                  to="/terms"
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium ${
                      isActive
                        ? 'bg-brand-soft text-brand font-semibold'
                        : 'text-ink-muted hover:bg-subtle hover:text-ink'
                    }`
                  }
                >
                  <FileText className="w-4 h-4" />
                  <span>Terms &amp; Disclaimer</span>
                </NavLink>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Top Utility Bar */}
        <header className="sticky top-0 z-30 h-14 bg-surface/90 backdrop-blur-md border-b border-line px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 no-print">
          {/* Left: Mobile drawer button + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg border border-line bg-surface hover:bg-subtle text-ink-secondary cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0">
              <Link
                to="/"
                className="lg:hidden font-bold text-ink tracking-tight flex-shrink-0"
              >
                StockClue
              </Link>
              <span className="lg:hidden text-ink-muted">/</span>
              <span className="font-semibold text-ink truncate">{sectionTitle}</span>
              {activeSymbol && (
                <>
                  <span className="text-ink-muted">/</span>
                  <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-brand-soft text-brand">
                    {activeSymbol}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Center / Right: Command Palette Trigger + Theme Toggle */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2.5 h-9 px-3 sm:w-64 md:w-72 rounded-lg border border-line bg-subtle/70 hover:bg-subtle hover:border-line-strong text-ink-muted text-xs transition-colors cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline truncate flex-1 text-left">
                Search ticker or command...
              </span>
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[11px] font-mono font-semibold text-ink-muted bg-surface border border-line rounded">
                ⌘K
              </kbd>
            </button>

            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
          </div>
        </header>

        {/* Page Container */}
        <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 print-expand">
          {children}
        </main>

        {/* Subtle Institutional Footer */}
        <footer className="border-t border-line py-4 px-4 sm:px-6 lg:px-8 text-xs text-ink-muted no-print">
          <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              StockClue · Value Investing &amp; Equity Research Terminal — Informational use only, not financial advice.
            </span>
            <Link
              to="/terms"
              className="font-medium text-ink-secondary hover:text-brand hover:underline transition-colors"
            >
              Terms of Service &amp; Disclaimer
            </Link>
          </div>
        </footer>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    </div>
  );
}
