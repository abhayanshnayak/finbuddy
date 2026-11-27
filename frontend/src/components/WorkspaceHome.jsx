import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Database,
  Tag,
  Clock,
  ArrowRight,
  Compass,
  Layers,
  Filter,
  ShieldCheck,
  Calculator,
  TrendingUp,
} from 'lucide-react';
import TickerSearchInput from './ui/TickerSearchInput';
import { useCompanies } from '../context/companiesStore';

const POPULAR_EXAMPLES = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'COST'];

export default function WorkspaceHome() {
  const navigate = useNavigate();
  const { companies, loading, recentTickers } = useCompanies();

  useEffect(() => {
    document.title = 'StockClue — Equity Research & Valuation Terminal';
  }, []);

  const uniqueTagCount = useMemo(() => {
    const set = new Set();
    companies.forEach((c) => (c.tags || []).forEach((t) => set.add(t.toLowerCase())));
    return set.size;
  }, [companies]);

  const handleOpenTicker = (sym) => {
    navigate(`/ticker/${encodeURIComponent(sym)}`);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Research Hero Launch Panel */}
      <section className="bg-surface border border-line rounded-xl p-6 sm:p-8">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-brand-soft text-brand text-xs font-semibold">
            <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
            <span>4-M Equity Research &amp; Valuation Workbench</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            Fundamental Equity Analysis &amp; Intrinsic Valuation
          </h1>
          <p className="text-sm text-ink-secondary leading-relaxed max-w-2xl">
            Synthesize 10-year SEC XBRL financials, multi-model valuations (Margin of Safety,
            Payback Time, 10-Cap Owner&apos;s Value), competitive moat structure, and AI qualitative
            filings research in a single auditable workspace.
          </p>

          <div className="pt-2 max-w-2xl">
            <TickerSearchInput onSelectTicker={handleOpenTicker} size="lg" />
          </div>

          {/* Quick-launch chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-ink-muted font-medium">Quick lookup:</span>
            {(companies.length > 0
              ? companies.slice(0, 6).map((c) => c.ticker)
              : POPULAR_EXAMPLES
            ).map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => handleOpenTicker(sym)}
                className="font-mono font-semibold px-2.5 py-1 rounded-md bg-subtle hover:bg-brand-soft text-ink-secondary hover:text-brand border border-line transition-colors cursor-pointer"
              >
                {sym}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Workspace Coverage Telemetry */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="flex items-center justify-between text-ink-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Indexed Coverage</span>
            <Database className="w-4 h-4 text-brand" aria-hidden="true" />
          </div>
          <p className="text-2xl font-bold text-ink font-mono num">
            {loading ? '—' : companies.length}
          </p>
          <p className="text-xs text-ink-muted mt-0.5">Cached company dossiers</p>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="flex items-center justify-between text-ink-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Research Tags</span>
            <Tag className="w-4 h-4 text-brand" aria-hidden="true" />
          </div>
          <p className="text-2xl font-bold text-ink font-mono num">
            {loading ? '—' : uniqueTagCount}
          </p>
          <p className="text-xs text-ink-muted mt-0.5">Active screening taxonomy</p>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="flex items-center justify-between text-ink-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Valuation Models</span>
            <Calculator className="w-4 h-4 text-brand" aria-hidden="true" />
          </div>
          <p className="text-2xl font-bold text-ink font-mono num">3</p>
          <p className="text-xs text-ink-muted mt-0.5">MOS · Payback · 10-Cap</p>
        </div>

        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="flex items-center justify-between text-ink-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Audit Standard</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          </div>
          <p className="text-2xl font-bold text-ink">100%</p>
          <p className="text-xs text-ink-muted mt-0.5">Deterministic XBRL math</p>
        </div>
      </section>

      {/* Main Two-Column Grid: Recent / Indexed Coverage + Workflow Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coverage / Recent Table */}
        <section className="lg:col-span-2 bg-surface border border-line rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-ink-muted" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink">
                {recentTickers.length > 0 ? 'Recently Viewed & Indexed Equities' : 'Indexed Equities'}
              </h2>
            </div>
            <Link
              to="/screener"
              className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1"
            >
              <span>Open Screener</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentTickers.length > 0 && (
            <div className="px-5 py-3 bg-subtle/60 border-b border-line flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-ink-muted mr-1">Recent:</span>
              {recentTickers.slice(0, 6).map((item) => (
                <button
                  key={item.ticker}
                  type="button"
                  onClick={() => handleOpenTicker(item.ticker)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-line hover:border-brand text-xs font-medium text-ink transition-colors cursor-pointer"
                >
                  <span className="font-mono font-bold text-brand">{item.ticker}</span>
                  {item.name && item.name !== item.ticker && (
                    <span className="text-ink-muted truncate max-w-[110px]">{item.name}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="overflow-x-auto flex-1">
            {loading ? (
              <div className="p-5 space-y-3 animate-pulse">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-9 rounded-lg bg-subtle" />
                ))}
              </div>
            ) : companies.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-sm font-medium text-ink-secondary">
                  No cached companies available yet.
                </p>
                <p className="text-xs text-ink-muted">
                  Search any US ticker above or run a batch import via Bulk Pipeline to build your database.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-subtle/70 text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-line">
                  <tr>
                    <th className="px-5 py-2.5">Ticker</th>
                    <th className="px-4 py-2.5">Company</th>
                    <th className="px-4 py-2.5 hidden sm:table-cell">Industry</th>
                    <th className="px-5 py-2.5 text-right">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {companies.slice(0, 8).map((company) => (
                    <tr
                      key={company.ticker}
                      onClick={() => handleOpenTicker(company.ticker)}
                      className="hover:bg-subtle/60 transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-3 font-mono font-bold text-xs text-ink group-hover:text-brand">
                        {company.ticker}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink truncate max-w-[220px]">
                        {company.name}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-muted hidden sm:table-cell truncate max-w-[180px]">
                        {company.industry || '—'}
                      </td>
                      <td className="px-5 py-3 text-right text-xs font-mono text-ink-muted num whitespace-nowrap">
                        {company.last_updated_pst || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Workflow Launch Cards */}
        <div className="space-y-4">
          <Link
            to="/curated"
            className="block bg-surface border border-line hover:border-brand/60 rounded-xl p-5 transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                <Compass className="w-4 h-4" />
              </div>
              <ArrowRight className="w-4 h-4 text-ink-muted group-hover:text-brand group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-ink">Curated Thematic Lists</h3>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-brand-soft text-brand border border-brand/20">
                10 Themes
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">
              Explore cached supply-chain lists across AI, Cloud, Robotics, Power, Auto, Utilities,
              Banks &amp; Healthcare with Big 4 trends, ROIC, ROE, margins, and maturity tags.
            </p>
          </Link>

          <Link
            to="/screener"
            className="block bg-surface border border-line hover:border-brand/60 rounded-xl p-5 transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-brand-soft text-brand flex items-center justify-center">
                <Filter className="w-4 h-4" />
              </div>
              <ArrowRight className="w-4 h-4 text-ink-muted group-hover:text-brand group-hover:translate-x-0.5 transition-all" />
            </div>
            <h3 className="text-sm font-semibold text-ink">Tag &amp; Company Screener</h3>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">
              Filter indexed equities using boolean AND/OR tag queries, sort coverage by industry or
              freshness, and drill directly into full valuation dossiers.
            </p>
          </Link>

          <Link
            to="/ingest"
            className="block bg-surface border border-line hover:border-brand/60 rounded-xl p-5 transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <ArrowRight className="w-4 h-4 text-ink-muted group-hover:text-brand group-hover:translate-x-0.5 transition-all" />
            </div>
            <h3 className="text-sm font-semibold text-ink">Bulk Ingestion Pipeline</h3>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">
              Queue up to 500 symbols with automatic deduplication, rate-limited API orchestration,
              custom watchlist tagging, and real-time job monitoring.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
