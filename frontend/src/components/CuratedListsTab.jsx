import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Compass,
  Cpu,
  Cloud,
  Bot,
  Shield,
  Zap,
  Car,
  Rocket,
  Plug,
  Landmark,
  HeartPulse,
  RefreshCw,
  Search,
  X,
  ChevronDown,
  ShieldCheck,
  Sparkles,
  Layers,
  Table2,
  Database,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import CuratedStockTable from './curated/CuratedStockTable';
import InfoTooltip from './ui/InfoTooltip';
import { formatMetricPercent } from '../utils/formatters';

const ICON_MAP = {
  cpu: Cpu,
  cloud: Cloud,
  bot: Bot,
  shield: Shield,
  zap: Zap,
  car: Car,
  rocket: Rocket,
  plug: Plug,
  landmark: Landmark,
  'heart-pulse': HeartPulse,
};

const FOCUS_BADGE = {
  tech: {
    label: 'Core Tech',
    cls: 'bg-brand-soft text-brand border-brand/25',
  },
  tech_enabled: {
    label: 'Tech-Enabled Infra',
    cls: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25',
  },
  diversified: {
    label: 'Diversified Sector',
    cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
  },
};

// Client-side session cache so switching back to previously viewed themes is instant
const CLIENT_CATEGORY_CACHE = new Map();

function CategorySkeleton() {
  return (
    <div className="space-y-5 animate-pulse" aria-busy="true" aria-label="Loading curated category">
      <div className="bg-surface border border-line rounded-xl p-6 space-y-3">
        <div className="h-6 w-56 bg-subtle rounded" />
        <div className="h-4 w-full max-w-2xl bg-subtle rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-20 rounded-lg bg-subtle" />
          ))}
        </div>
      </div>
      {[1, 2].map((n) => (
        <div key={n} className="bg-surface border border-line rounded-xl p-5 space-y-3">
          <div className="h-5 w-64 bg-subtle rounded" />
          <div className="h-14 w-full bg-subtle rounded-lg" />
          <div className="h-14 w-full bg-subtle rounded-lg" />
          <div className="h-14 w-full bg-subtle rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/**
 * Keyed per activeCategoryId so local filters & bucket open/close state reset cleanly
 * when switching themes without calling setState inside useEffect.
 */
function CuratedCategoryWorkspace({ activeData }) {
  const bucketsHeadingId = useId();
  const accordionId = useId();
  const accordionRef = useRef(null);
  const viewTabRefs = useRef([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all'); // 'all' | 'established' | 'future_potential'
  const [selectedBucketId, setSelectedBucketId] = useState('all');
  const [viewMode, setViewMode] = useState('buckets'); // 'buckets' | 'all'
  const [openBucketIds, setOpenBucketIds] = useState({});

  const filteredBuckets = useMemo(() => {
    const buckets = activeData?.buckets || [];
    const q = searchQuery.trim().toLowerCase();

    return buckets
      .filter((b) => selectedBucketId === 'all' || b.id === selectedBucketId)
      .map((bucket) => {
        const filteredCompanies = (bucket.companies || []).filter((co) => {
          if (stageFilter !== 'all' && co.stage !== stageFilter) return false;
          if (q) {
            const hay = `${co.ticker} ${co.name} ${co.overview} ${co.stage_rationale} ${co.industry}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });
        return { ...bucket, companies: filteredCompanies };
      })
      .filter((bucket) => bucket.companies.length > 0 || (!q && stageFilter === 'all'));
  }, [activeData, searchQuery, stageFilter, selectedBucketId]);

  const flatFilteredCompanies = useMemo(
    () => filteredBuckets.flatMap((b) => b.companies || []),
    [filteredBuckets]
  );

  // Expanded=true ONLY when every visible bucket is open; mixed state reads "Expand all"
  const allBucketsExpanded = useMemo(() => {
    if (filteredBuckets.length === 0) return false;
    return filteredBuckets.every((b) => openBucketIds[b.id] !== false);
  }, [filteredBuckets, openBucketIds]);

  const handleToggleAllBuckets = useCallback(() => {
    const shouldExpand = !allBucketsExpanded;
    const next = {};
    filteredBuckets.forEach((b) => {
      next[b.id] = shouldExpand;
    });
    setOpenBucketIds((prev) => ({ ...prev, ...next }));
  }, [allBucketsExpanded, filteredBuckets]);

  // Support native Invoker Commands (--toggle-all) on accordion container when supported
  useEffect(() => {
    const el = accordionRef.current;
    if (!el) return undefined;
    const onCommand = (event) => {
      if (event.command === '--toggle-all') {
        handleToggleAllBuckets();
      }
    };
    el.addEventListener('command', onCommand);
    return () => el.removeEventListener('command', onCommand);
  }, [handleToggleAllBuckets]);

  const supportsInvokerCommands =
    typeof HTMLButtonElement !== 'undefined' &&
    'commandForElement' in HTMLButtonElement.prototype;

  const handleViewTabKeyDown = (e, idx) => {
    const modes = ['buckets', 'all'];
    let nextIdx = null;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % modes.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + modes.length) % modes.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = modes.length - 1;
    if (nextIdx !== null) {
      e.preventDefault();
      setViewMode(modes[nextIdx]);
      viewTabRefs.current[nextIdx]?.focus();
    }
  };

  const ActiveIcon = ICON_MAP[activeData.icon] || Compass;
  const activeFocusBadge = FOCUS_BADGE[activeData.sector_focus] || FOCUS_BADGE.tech;

  return (
    <div className="space-y-5">
      {/* Category Summary Card & Supply Chain Map */}
      <section className="bg-surface border border-line rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-soft text-brand flex items-center justify-center flex-shrink-0">
                <ActiveIcon className="w-4 h-4" aria-hidden="true" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-ink tracking-tight">
                {activeData.name}
              </h2>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${activeFocusBadge.cls}`}
              >
                {activeFocusBadge.label}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
              {activeData.description}
            </p>
          </div>

          {/* Compact Category KPI Telemetry */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2.5 flex-shrink-0">
            <div className="rounded-lg bg-subtle/60 border border-line px-3 py-2.5 min-w-[125px]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted block">
                Curated Picks
              </span>
              <p className="text-base font-bold font-mono text-ink num mt-0.5">
                {activeData.company_count}
                <span className="text-xs font-normal text-ink-muted"> / 20</span>
              </p>
              <span className="text-[10px] text-ink-muted">
                {activeData.established_count} Est. · {activeData.future_potential_count} Future
              </span>
            </div>

            <div className="rounded-lg bg-subtle/60 border border-line px-3 py-2.5 min-w-[125px]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted block">
                Median ROIC
              </span>
              <p className="text-base font-bold font-mono text-ink num mt-0.5">
                {formatMetricPercent(activeData.summary?.median_roic_pct, 1)}
              </p>
              <span className="text-[10px] text-ink-muted font-mono num">
                ROE: {formatMetricPercent(activeData.summary?.median_roe_pct, 1)}
              </span>
            </div>

            <div className="rounded-lg bg-subtle/60 border border-line px-3 py-2.5 min-w-[125px]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted block">
                Median NI Mgn
              </span>
              <p className="text-base font-bold font-mono text-ink num mt-0.5">
                {formatMetricPercent(activeData.summary?.median_ni_margin_pct, 1)}
              </p>
              <span className="text-[10px] text-ink-muted">Net Profitability</span>
            </div>

            <div className="rounded-lg bg-subtle/60 border border-line px-3 py-2.5 min-w-[125px]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted block">
                Median FCF Mgn
              </span>
              <p className="text-base font-bold font-mono text-ink num mt-0.5">
                {formatMetricPercent(activeData.summary?.median_fcf_margin_pct, 1)}
              </p>
              <span className="text-[10px] text-ink-muted">Cash Conversion</span>
            </div>
          </div>
        </div>

        {/* Interactive Supply Chain Value-Flow Filter Strip */}
        <div className="pt-3 border-t border-line space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              Supply Chain Map ({activeData.bucket_count} Buckets)
            </span>
            {selectedBucketId !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedBucketId('all')}
                className="text-xs font-semibold text-brand hover:underline cursor-pointer"
              >
                Show all stages
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedBucketId('all')}
              aria-pressed={selectedBucketId === 'all'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                selectedBucketId === 'all'
                  ? 'bg-brand text-white border-brand shadow-sm'
                  : 'bg-surface text-ink-secondary hover:text-ink border-line hover:border-line-strong'
              }`}
            >
              <span>All Supply Chain Stages</span>
              <span
                className={`font-mono text-[10px] num ${
                  selectedBucketId === 'all' ? 'text-white/80' : 'text-ink-muted'
                }`}
              >
                {activeData.company_count}
              </span>
            </button>

            {(activeData.buckets || []).map((bucket, idx) => {
              const isSelected = selectedBucketId === bucket.id;
              return (
                <div key={bucket.id} className="inline-flex items-center gap-2">
                  {idx > 0 && (
                    <ArrowRight
                      className="w-3.5 h-3.5 text-ink-muted/60 hidden sm:inline flex-shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedBucketId((prev) => (prev === bucket.id ? 'all' : bucket.id))
                    }
                    aria-pressed={isSelected}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-brand text-white border-brand shadow-sm'
                        : 'bg-subtle/60 hover:bg-subtle text-ink-secondary hover:text-ink border-line hover:border-line-strong'
                    }`}
                  >
                    <span
                      className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded num ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-surface text-brand border border-line'
                      }`}
                    >
                      {bucket.stage_order}
                    </span>
                    <span>{bucket.name}</span>
                    <span
                      className={`font-mono text-[10px] num ${
                        isSelected ? 'text-white/80' : 'text-ink-muted'
                      }`}
                    >
                      ({bucket.company_count})
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Controls Bar: Search, Maturity Filter, View Mode Tabs, Expand/Collapse All */}
      <div className="bg-surface border border-line rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Filter ${activeData.short_name || activeData.name} tickers or roles...`}
              aria-label="Filter companies in this curated category"
              className="w-full pl-9 pr-8 py-2 bg-canvas border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 rounded-lg text-xs sm:text-sm text-ink placeholder:text-ink-muted outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear filter search"
                className="absolute right-2.5 top-2.5 text-ink-muted hover:text-ink cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="inline-flex items-center gap-1.5">
            <div
              role="group"
              aria-label="Filter by maturity profile"
              className="inline-flex bg-subtle p-0.5 rounded-lg border border-line"
            >
              {[
                { id: 'all', label: 'All' },
                { id: 'established', label: 'Established', icon: ShieldCheck },
                { id: 'future_potential', label: 'Future Potential', icon: Sparkles },
              ].map((opt) => {
                const OptIcon = opt.icon;
                const active = stageFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStageFilter(opt.id)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-surface text-brand shadow-sm'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {OptIcon && <OptIcon className="w-3 h-3" aria-hidden="true" />}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <InfoTooltip term="maturityStage" />
          </div>
        </div>

        {/* Right: View Switcher Tablist + Expand/Collapse All */}
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="tablist"
            aria-label="Display layout"
            className="inline-flex items-center border-b border-line"
          >
            {[
              { id: 'buckets', label: 'Supply Chain Buckets', icon: Layers },
              { id: 'all', label: `Compare All (${flatFilteredCompanies.length})`, icon: Table2 },
            ].map((tab, idx) => {
              const TabIcon = tab.icon;
              const selected = viewMode === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={(el) => {
                    viewTabRefs.current[idx] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`curated-view-tab-${tab.id}`}
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setViewMode(tab.id)}
                  onKeyDown={(e) => handleViewTabKeyDown(e, idx)}
                  className={`sc-view-tab relative inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    selected ? 'text-brand' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {viewMode === 'buckets' && filteredBuckets.length > 1 && (
            <button
              type="button"
              {...(supportsInvokerCommands
                ? { commandfor: accordionId, command: '--toggle-all' }
                : { onClick: handleToggleAllBuckets })}
              aria-expanded={allBucketsExpanded}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-subtle hover:bg-line/70 text-ink-secondary hover:text-ink border border-line transition-colors cursor-pointer"
            >
              <span>{allBucketsExpanded ? 'Collapse all' : 'Expand all'}</span>
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: Grouped by Supply Chain Buckets (Native <details> Accordions) */}
      {viewMode === 'buckets' && (
        <div role="tabpanel" aria-labelledby="curated-view-tab-buckets">
          <section
            ref={accordionRef}
            id={accordionId}
            aria-labelledby={bucketsHeadingId}
            className="space-y-4"
          >
            <h3 id={bucketsHeadingId} className="visually-hidden">
              {activeData.name} Supply Chain Buckets
            </h3>

            {filteredBuckets.length === 0 ? (
              <div className="bg-surface border border-line rounded-xl py-14 px-6 text-center space-y-2">
                <p className="text-sm font-semibold text-ink-secondary">
                  No curated stocks match your current filters.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStageFilter('all');
                    setSelectedBucketId('all');
                  }}
                  className="text-xs font-semibold text-brand hover:underline cursor-pointer"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              filteredBuckets.map((bucket) => {
                const isOpen = openBucketIds[bucket.id] !== false;
                return (
                  <details
                    key={bucket.id}
                    open={isOpen}
                    onToggle={(e) => {
                      const nowOpen = e.currentTarget.open;
                      setOpenBucketIds((prev) =>
                        prev[bucket.id] === nowOpen
                          ? prev
                          : { ...prev, [bucket.id]: nowOpen }
                      );
                    }}
                    className="sc-bucket-details bg-surface border border-line rounded-xl overflow-hidden"
                  >
                    {/* Keep headings out of <summary> so screen readers preserve heading navigation */}
                    <summary className="px-4 sm:px-5 py-4 bg-subtle/50 hover:bg-subtle/80 transition-colors cursor-pointer select-none flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <ChevronDown
                          className="sc-bucket-chevron w-4 h-4 text-ink-muted mt-0.5 flex-shrink-0"
                          aria-hidden="true"
                        />
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-brand-soft text-brand border border-brand/20">
                              Stage {bucket.stage_order} · {bucket.supply_chain_role}
                            </span>
                            <strong className="text-sm sm:text-base font-bold text-ink">
                              {bucket.name}
                            </strong>
                            <span className="font-mono text-xs text-ink-muted num">
                              ({bucket.companies.length}{' '}
                              {bucket.companies.length === 1 ? 'stock' : 'stocks'})
                            </span>
                          </div>
                          <p className="text-xs text-ink-muted leading-relaxed">
                            {bucket.description}
                          </p>
                        </div>
                      </div>

                      {/* Bucket-Level Benchmark Chips */}
                      <div className="flex flex-wrap items-center gap-2 pl-6 md:pl-0 flex-shrink-0 text-[11px] font-mono num">
                        {bucket.median_roic_pct !== null &&
                          bucket.median_roic_pct !== undefined && (
                            <span className="px-2 py-1 rounded-md bg-surface border border-line text-ink-secondary">
                              Med ROIC:{' '}
                              <strong className="text-ink">
                                {formatMetricPercent(bucket.median_roic_pct, 1)}
                              </strong>
                            </span>
                          )}
                        {bucket.median_fcf_margin_pct !== null &&
                          bucket.median_fcf_margin_pct !== undefined && (
                            <span className="px-2 py-1 rounded-md bg-surface border border-line text-ink-secondary">
                              Med FCF:{' '}
                              <strong className="text-ink">
                                {formatMetricPercent(bucket.median_fcf_margin_pct, 1)}
                              </strong>
                            </span>
                          )}
                      </div>
                    </summary>

                    <div className="border-t border-line">
                      <CuratedStockTable
                        companies={bucket.companies}
                        caption={`${activeData.name} — ${bucket.name} supply chain companies`}
                      />
                    </div>
                  </details>
                );
              })
            )}
          </section>
        </div>
      )}

      {/* VIEW 2: Compare All Stocks Across Category in One Sortable Table */}
      {viewMode === 'all' && (
        <div role="tabpanel" aria-labelledby="curated-view-tab-all">
          <div className="bg-surface border border-line rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-line bg-subtle/40 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-ink">
                Full Category Comparison — {flatFilteredCompanies.length} Equities
              </span>
              <span className="text-ink-muted">
                Click any column header to rank the entire {activeData.short_name || activeData.name} supply chain
              </span>
            </div>

            <CuratedStockTable
              companies={flatFilteredCompanies}
              caption={`All curated stocks in ${activeData.name}`}
              showBucketTag
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function CuratedListsTab() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const scrollerRef = useRef(null);

  const [categories, setCategories] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState('');

  const [categoryState, setCategoryState] = useState({
    id: '',
    data: null,
    error: '',
  });
  const [refreshingCategory, setRefreshingCategory] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  const activeCategoryId = useMemo(() => {
    if (categoryId) return decodeURIComponent(categoryId).toLowerCase();
    return categories[0]?.id || 'ai-semiconductors';
  }, [categoryId, categories]);

  const cachedForActive = CLIENT_CATEGORY_CACHE.get(activeCategoryId) || null;
  const activeData =
    categoryState.id === activeCategoryId ? categoryState.data : cachedForActive;
  const categoryError =
    categoryState.id === activeCategoryId ? categoryState.error : '';
  const loadingCategory =
    Boolean(activeCategoryId) && !activeData && !categoryError;

  const handleRetryLoad = useCallback(() => {
    setCatalogError('');
    setCategoryState({ id: '', data: null, error: '' });
    setRetryNonce((n) => n + 1);
  }, []);

  // 1. Load catalog metadata of all 10 curated categories
  useEffect(() => {
    const controller = new AbortController();
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    fetch(`${apiBase}/api/curated-lists`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load curated category list.');
        return res.json();
      })
      .then((json) => {
        if (controller.signal.aborted) return;
        setCategories(Array.isArray(json.categories) ? json.categories : []);
        setCatalogError('');
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setCatalogError(err.message || 'Unable to reach Curated Lists backend.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingCatalog(false);
      });

    return () => controller.abort();
  }, [retryNonce]);

  // 2. Fetch enriched active category on cache miss (zero synchronous setState in effect)
  useEffect(() => {
    if (!activeCategoryId || CLIENT_CATEGORY_CACHE.has(activeCategoryId)) {
      return undefined;
    }

    const controller = new AbortController();
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    fetch(`${apiBase}/api/curated-lists/${encodeURIComponent(activeCategoryId)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          let detail = 'Unable to load curated category.';
          try {
            const errJson = await res.json();
            if (errJson?.detail) detail = errJson.detail;
          } catch {
            // keep default
          }
          throw new Error(detail);
        }
        return res.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        CLIENT_CATEGORY_CACHE.set(activeCategoryId, data);
        setCategoryState({ id: activeCategoryId, data, error: '' });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setCategoryState({
          id: activeCategoryId,
          data: null,
          error: err.message || 'Failed to load curated stocks.',
        });
      });

    return () => controller.abort();
  }, [activeCategoryId, retryNonce]);

  // Document title sync
  useEffect(() => {
    if (activeData?.name) {
      document.title = `${activeData.name} — Curated Lists · StockClue`;
    } else {
      document.title = 'Curated Thematic Lists — StockClue';
    }
  }, [activeData]);

  // Keep active category link scrolled into view inside the single-row strip
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const activeEl = scroller.querySelector('[aria-current="page"]');
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [activeCategoryId, categories]);

  // IntersectionObserver fallback for edge fades when scroll-driven animations are unsupported
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || categories.length === 0) return undefined;
    if (
      typeof CSS !== 'undefined' &&
      CSS.supports?.('animation-timeline', 'scroll(self inline)')
    ) {
      return undefined;
    }

    const first = scroller.firstElementChild;
    const last = scroller.lastElementChild;
    if (!first || !last) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const { target, intersectionRatio } of entries) {
          if (target === first) {
            scroller.classList.toggle('more-start', intersectionRatio < 1);
          }
          if (target === last) {
            scroller.classList.toggle('more-end', intersectionRatio < 1);
          }
        }
      },
      { root: scroller, threshold: 1, rootMargin: '1px' }
    );

    observer.observe(first);
    observer.observe(last);
    return () => observer.disconnect();
  }, [categories]);

  const handleRefreshCategory = useCallback(async () => {
    if (!activeCategoryId || refreshingCategory) return;
    setRefreshingCategory(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(
        `${apiBase}/api/curated-lists/${encodeURIComponent(activeCategoryId)}/refresh`,
        { method: 'POST' }
      );
      if (!res.ok) {
        let detail = 'Failed to refresh category cache.';
        try {
          const errJson = await res.json();
          if (errJson?.detail) detail = errJson.detail;
        } catch {
          // ignore
        }
        throw new Error(detail);
      }
      const fresh = await res.json();
      CLIENT_CATEGORY_CACHE.set(activeCategoryId, fresh);
      setCategoryState({ id: activeCategoryId, data: fresh, error: '' });
      setCategories((prev) =>
        prev.map((c) =>
          c.id === activeCategoryId
            ? {
                ...c,
                is_cached: true,
                cached_at: fresh.cached_at,
                cached_at_pst: fresh.cached_at_pst,
              }
            : c
        )
      );
    } catch (err) {
      setCategoryState((prev) => ({
        id: activeCategoryId,
        data: prev.id === activeCategoryId ? prev.data : cachedForActive,
        error: err.message || 'Unable to refresh cached category metrics.',
      }));
    } finally {
      setRefreshingCategory(false);
    }
  }, [activeCategoryId, refreshingCategory, cachedForActive]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Page Header + Single-Row Scrollable 10-Category Selector */}
      <section className="bg-surface border border-line rounded-xl overflow-hidden">
        <div className="px-5 sm:px-6 pt-5 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold text-ink flex items-center gap-2.5 tracking-tight">
              <Compass className="w-5 h-5 text-brand flex-shrink-0" aria-hidden="true" />
              <span>Curated Thematic Lists</span>
            </h1>
            <p className="text-xs sm:text-sm text-ink-muted max-w-3xl">
              High-conviction thematic research across {categories.length || 10} cached sectors,
              organized end-to-end across each supply chain with Big 4 trends, capital returns,
              margins, balance-sheet health, and Established vs. Future Potential ratings.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            {activeData?.cached_at_pst && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-subtle border border-line text-[11px] font-medium text-ink-muted"
                title={`Cache source: ${activeData.cache_source || 'cached'}`}
              >
                <Database
                  className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <span>Cached · {activeData.cached_at_pst} PST</span>
              </span>
            )}
            <button
              type="button"
              onClick={handleRefreshCategory}
              disabled={loadingCategory || refreshingCategory || !activeCategoryId}
              className="inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface hover:bg-subtle text-ink-secondary hover:text-ink border border-line-strong transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshingCategory ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{refreshingCategory ? 'Refreshing...' : 'Refresh Metrics'}</span>
            </button>
          </div>
        </div>

        {catalogError && (
          <div
            role="alert"
            className="mx-5 my-4 flex items-center justify-between gap-3 bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/25 rounded-lg px-4 py-3 text-xs font-semibold"
          >
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>{catalogError}</span>
            </div>
            <button
              type="button"
              onClick={handleRetryLoad}
              className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer flex-shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Single-Row Scrollable Category Navigation Strip with Scroll-Driven Edge Fades */}
        <nav aria-label="Curated investment themes" className="bg-subtle/40">
          {loadingCatalog ? (
            <div className="flex items-center gap-2 px-5 py-3 overflow-hidden animate-pulse">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <div key={n} className="h-9 w-32 rounded-lg bg-subtle flex-shrink-0" />
              ))}
            </div>
          ) : (
            <div ref={scrollerRef} className="sc-category-scroller px-4 sm:px-5 gap-1">
              {categories.map((cat) => {
                const Icon = ICON_MAP[cat.icon] || Compass;
                const isActive = cat.id === activeCategoryId;
                return (
                  <Link
                    key={cat.id}
                    to={`/curated/${encodeURIComponent(cat.id)}`}
                    aria-current={isActive ? 'page' : undefined}
                    className={`sc-category-tab inline-flex items-center gap-2 px-3.5 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                      isActive ? 'text-brand' : 'text-ink-secondary hover:text-ink'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                    <span>{cat.short_name || cat.name}</span>
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded num ${
                        isActive
                          ? 'bg-brand-soft text-brand'
                          : 'bg-surface border border-line text-ink-muted'
                      }`}
                    >
                      {cat.company_count}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </nav>
      </section>

      {/* Error State for Active Category */}
      {categoryError && (
        <div
          role="alert"
          className="bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 rounded-xl p-4 flex items-start justify-between gap-3 text-sm"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold">Unable to load curated category</p>
              <p className="text-xs opacity-90 mt-0.5">{categoryError}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={handleRetryLoad}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => navigate('/curated/ai-semiconductors')}
              className="text-xs font-semibold underline cursor-pointer"
            >
              Open AI &amp; Semis
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loadingCategory && <CategorySkeleton />}

      {/* Active Category Workspace (keyed by category ID to cleanly reset filters on switch) */}
      {activeData && !loadingCategory && (
        <CuratedCategoryWorkspace key={activeData.id} activeData={activeData} />
      )}
    </div>
  );
}
