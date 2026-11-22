import { useState, useMemo } from 'react';
import {
  Layers,
  Coins,
  Repeat,
  Users,
  CreditCard,
  Scale,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Eye,
  AlertCircle,
  Sparkles,
  PieChart,
  TrendingUp,
} from 'lucide-react';

const DIVISION_PALETTE = [
  {
    bar: 'bg-blue-600 dark:bg-blue-500',
    dot: 'bg-blue-600 dark:bg-blue-500',
    badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25',
  },
  {
    bar: 'bg-emerald-600 dark:bg-emerald-500',
    dot: 'bg-emerald-600 dark:bg-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  },
  {
    bar: 'bg-violet-600 dark:bg-violet-500',
    dot: 'bg-violet-600 dark:bg-violet-500',
    badge: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/25',
  },
  {
    bar: 'bg-amber-500 dark:bg-amber-400',
    dot: 'bg-amber-500 dark:bg-amber-400',
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
  },
  {
    bar: 'bg-cyan-600 dark:bg-cyan-500',
    dot: 'bg-cyan-600 dark:bg-cyan-500',
    badge: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/25',
  },
  {
    bar: 'bg-rose-500 dark:bg-rose-400',
    dot: 'bg-rose-500 dark:bg-rose-400',
    badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25',
  },
  {
    bar: 'bg-slate-500 dark:bg-slate-400',
    dot: 'bg-slate-500 dark:bg-slate-400',
    badge: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/25',
  },
];

function parseNumericPct(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const cleaned = String(val).replace(/[%,\s]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRoleBadgeClass(role = '') {
  const r = role.toLowerCase();
  if (r.includes('cash cow') || r.includes('profit')) {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25';
  }
  if (r.includes('growth')) {
    return 'bg-brand-soft text-brand border-brand/25';
  }
  if (r.includes('margin')) {
    return 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/25';
  }
  if (r.includes('funnel') || r.includes('ecosystem')) {
    return 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/25';
  }
  if (r.includes('bet') || r.includes('emerging')) {
    return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25';
  }
  return 'bg-subtle text-ink-secondary border-line';
}

function getGrowthTextClass(growth = '') {
  const str = String(growth).trim();
  if (str.startsWith('+') || /accelerat|grow|expand/i.test(str)) {
    if (str.startsWith('-') || str.startsWith('−')) {
      return 'text-rose-600 dark:text-rose-400';
    }
    return 'text-emerald-600 dark:text-emerald-400';
  }
  if (str.startsWith('-') || str.startsWith('−') || /declin|contract/i.test(str)) {
    return 'text-rose-600 dark:text-rose-400';
  }
  return 'text-ink-secondary';
}

function getMarginBadgeClass(marginPct) {
  if (marginPct === null) return 'bg-subtle text-ink-secondary border-line';
  if (marginPct < 0) {
    return 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25';
  }
  if (marginPct >= 25) {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25';
  }
  if (marginPct >= 10) {
    return 'bg-brand-soft text-brand border-brand/25';
  }
  return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25';
}

function BusinessModelSkeleton() {
  return (
    <div className="space-y-5 animate-pulse" aria-busy="true">
      <div className="h-20 rounded-xl bg-subtle border border-line" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="p-4 rounded-lg bg-subtle border border-line space-y-2.5">
            <div className="h-3.5 w-1/3 bg-line rounded" />
            <div className="h-3 w-full bg-line rounded" />
            <div className="h-3 w-5/6 bg-line rounded" />
          </div>
        ))}
      </div>
      <div className="h-8 rounded-lg bg-subtle border border-line" />
      <div className="space-y-3">
        {[1, 2].map((n) => (
          <div key={n} className="h-28 rounded-xl bg-subtle border border-line" />
        ))}
      </div>
    </div>
  );
}

export default function BusinessModelSection({
  companyName,
  businessModel,
  loading,
  error,
  onRefresh,
}) {
  const [toggleOverrides, setToggleOverrides] = useState({});

  const divisions = useMemo(
    () => (Array.isArray(businessModel?.earnings_divisions) ? businessModel.earnings_divisions : []),
    [businessModel]
  );

  const mixSegments = useMemo(() => {
    const parsed = divisions.map((div, idx) => ({
      idx,
      name: div.name || `Division ${idx + 1}`,
      share: parseNumericPct(div.revenue_share_pct),
      palette: DIVISION_PALETTE[idx % DIVISION_PALETTE.length],
    }));
    const valid = parsed.filter((item) => item.share !== null && item.share > 0);
    const total = valid.reduce((sum, item) => sum + item.share, 0);
    return {
      items: valid.map((item) => ({
        ...item,
        normalizedWidth: total > 0 ? (item.share / total) * 100 : 0,
      })),
      total,
    };
  }, [divisions]);

  const how = businessModel?.how_it_makes_money || {};
  const unitEcon = businessModel?.company_unit_economics || {};
  const unitMetrics = Array.isArray(unitEcon.key_unit_metrics) ? unitEcon.key_unit_metrics : [];
  const watchItems = Array.isArray(businessModel?.earnings_watch_items)
    ? businessModel.earnings_watch_items
    : [];
  const sourcesReferenced = Array.isArray(businessModel?.sources_referenced)
    ? businessModel.sources_referenced
    : [];

  const isDivisionOpen = (idx) => (idx in toggleOverrides ? toggleOverrides[idx] : idx < 2);

  const toggleDivision = (idx) => {
    setToggleOverrides((prev) => ({
      ...prev,
      [idx]: !(idx in prev ? prev[idx] : idx < 2),
    }));
  };

  const focusDivision = (idx) => {
    setToggleOverrides((prev) => ({ ...prev, [idx]: true }));
    requestAnimationFrame(() => {
      const el = document.getElementById(`division-card-${idx}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  };

  const allExpanded =
    divisions.length > 0 && divisions.every((_, idx) => isDivisionOpen(idx));

  const toggleAllDivisions = () => {
    const nextState = !allExpanded;
    const nextMap = {};
    divisions.forEach((_, idx) => {
      nextMap[idx] = nextState;
    });
    setToggleOverrides(nextMap);
  };

  const hasContent = Boolean(
    businessModel &&
      (businessModel.executive_summary ||
        how.core_mechanics ||
        unitEcon.unit_economics_summary ||
        divisions.length > 0)
  );

  const monetizationCards = [
    {
      key: 'core_mechanics',
      title: 'How a Dollar Enters the Business',
      icon: Coins,
      body: how.core_mechanics,
    },
    {
      key: 'pricing_and_billing_model',
      title: 'Pricing & Billing Mechanics',
      icon: CreditCard,
      body: how.pricing_and_billing_model,
    },
    {
      key: 'recurring_vs_transactional_mix',
      title: 'Recurring vs. Transactional Mix',
      icon: Repeat,
      body: how.recurring_vs_transactional_mix,
    },
    {
      key: 'customer_and_channel_dynamics',
      title: 'Customers & Distribution Channels',
      icon: Users,
      body: how.customer_and_channel_dynamics,
    },
  ].filter((item) => Boolean(item.body));

  return (
    <section
      id="section-business-model"
      aria-labelledby="business-model-heading"
      className="bg-surface border border-line rounded-xl p-5 sm:p-6 space-y-6 scroll-mt-32"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-line pb-4">
        <div className="space-y-1">
          <h2
            id="business-model-heading"
            className="text-lg font-bold text-ink flex items-center gap-2"
          >
            <Layers className="w-4 h-4 text-brand flex-shrink-0" aria-hidden="true" />
            <span>Business Model, Unit Economics &amp; Earnings Divisions</span>
          </h2>
          <p className="text-xs text-ink-muted">
            {businessModel?.reporting_period_basis ||
              'Exact monetization mechanics, core unit economics, and breakdown by reportable earnings segments'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {businessModel?.revenue_model_archetype && !loading && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-brand-soft text-brand border border-brand/20">
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              <span>{businessModel.revenue_model_archetype}</span>
            </span>
          )}

          {loading && (
            <span className="text-xs font-semibold text-brand bg-brand-soft px-2.5 py-1 rounded-md border border-brand/20 animate-pulse">
              Synthesizing earnings segments &amp; unit economics...
            </span>
          )}

          {onRefresh && !loading && (
            <button
              type="button"
              onClick={onRefresh}
              title="Regenerate business model & earnings segment breakdown"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-subtle hover:bg-brand-soft text-ink-secondary hover:text-brand border border-line transition-colors cursor-pointer no-print"
            >
              <RefreshCw className="w-3 h-3" aria-hidden="true" />
              <span>{hasContent ? 'Refresh' : 'Generate'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && <BusinessModelSkeleton />}

      {/* Error / Empty State */}
      {!loading && !hasContent && (
        <div className="p-5 rounded-xl bg-subtle/50 border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-ink-muted flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-ink">
                {error
                  ? 'Could not synthesize business model breakdown'
                  : 'Business model & earnings segment breakdown not yet generated'}
              </p>
              <p className="text-xs text-ink-muted">
                {error ||
                  `Generate a full breakdown of how ${companyName || 'this company'} makes money, its unit economics, and reportable earnings divisions.`}
              </p>
            </div>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-brand hover:bg-brand-hover text-white transition-colors cursor-pointer flex-shrink-0 no-print"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Generate Breakdown</span>
            </button>
          )}
        </div>
      )}

      {/* Loaded Content */}
      {!loading && hasContent && (
        <div className="space-y-6">
          {/* 1. Executive Money-Making Engine Summary + 4 Monetization Pillars */}
          {(businessModel.executive_summary || monetizationCards.length > 0) && (
            <div className="space-y-4 print-break-avoid">
              {businessModel.executive_summary && (
                <div className="p-4 sm:p-5 rounded-xl bg-brand-soft/60 border border-brand/20 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand block">
                    How {companyName || 'the Company'} Makes Money — Executive Summary
                  </span>
                  <p className="text-sm text-ink leading-relaxed max-w-[88ch] whitespace-pre-wrap">
                    {businessModel.executive_summary}
                  </p>
                </div>
              )}

              {monetizationCards.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {monetizationCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <div
                        key={card.key}
                        className="p-4 rounded-xl bg-subtle/50 border border-line space-y-2"
                      >
                        <h3 className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-2">
                          <span className="w-6 h-6 rounded-md bg-surface border border-line inline-flex items-center justify-center text-brand flex-shrink-0">
                            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                          </span>
                          <span>{card.title}</span>
                        </h3>
                        <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">
                          {card.body}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. Unit Economics Deep Dive */}
          {(unitEcon.core_economic_unit ||
            unitMetrics.length > 0 ||
            unitEcon.unit_economics_summary) && (
            <div className="space-y-4 pt-2 border-t border-line print-break-avoid">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                    <Scale className="w-4 h-4 text-brand" aria-hidden="true" />
                    <span>Unit Economics &amp; Cash Conversion Mechanics</span>
                  </h3>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Industry-native economics per core unit, operating leverage, and working-capital dynamics
                  </p>
                </div>

                {unitEcon.core_economic_unit && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-subtle border border-line text-xs self-start sm:self-auto">
                    <span className="font-semibold uppercase tracking-wider text-[11px] text-ink-muted">
                      Core Unit:
                    </span>
                    <span className="font-semibold text-ink">{unitEcon.core_economic_unit}</span>
                  </div>
                )}
              </div>

              {/* Key Unit Metrics KPI Grid */}
              {unitMetrics.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {unitMetrics.map((metric, idx) => (
                    <div
                      key={metric.label || idx}
                      className="cq-card p-3.5 rounded-xl bg-subtle/60 border border-line space-y-1.5"
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted block">
                        {metric.label}
                      </span>
                      <span className="text-base font-bold font-mono text-ink num block">
                        {metric.value}
                      </span>
                      {metric.context && (
                        <p className="text-xs text-ink-secondary leading-relaxed">
                          {metric.context}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 3-Column Unit Economics Narrative */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {unitEcon.unit_economics_summary && (
                  <div className="p-4 rounded-xl bg-surface border border-line space-y-1.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-brand flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Per-Unit Breakdown</span>
                    </h4>
                    <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">
                      {unitEcon.unit_economics_summary}
                    </p>
                  </div>
                )}

                {unitEcon.cost_structure_and_operating_leverage && (
                  <div className="p-4 rounded-xl bg-surface border border-line space-y-1.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-brand" aria-hidden="true" />
                      <span>Cost Structure &amp; Operating Leverage</span>
                    </h4>
                    <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">
                      {unitEcon.cost_structure_and_operating_leverage}
                    </p>
                  </div>
                )}

                {unitEcon.cash_conversion_and_working_capital && (
                  <div className="p-4 rounded-xl bg-surface border border-line space-y-1.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-brand" aria-hidden="true" />
                      <span>Cash Conversion &amp; Working Capital</span>
                    </h4>
                    <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">
                      {unitEcon.cash_conversion_and_working_capital}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. Earnings Reporting Divisions / Segments Breakdown */}
          {divisions.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-line">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-brand" aria-hidden="true" />
                    <span>Earnings Reporting Divisions &amp; Segment Economics</span>
                    <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-subtle text-ink-secondary border border-line">
                      {divisions.length} {divisions.length === 1 ? 'Division' : 'Divisions'}
                    </span>
                  </h3>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Structured by the operating segments &amp; revenue lines management reports on quarterly earnings calls
                  </p>
                </div>

                <button
                  type="button"
                  onClick={toggleAllDivisions}
                  className="text-xs font-semibold text-brand hover:underline cursor-pointer no-print"
                >
                  {allExpanded ? 'Collapse All Divisions' : 'Expand All Divisions'}
                </button>
              </div>

              {/* Revenue Mix Visual Stacked Bar */}
              {mixSegments.items.length >= 2 && (
                <div className="p-4 rounded-xl bg-subtle/40 border border-line space-y-3 print-break-avoid">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold uppercase tracking-wider text-ink-muted">
                      Revenue Mix by Earnings Division
                    </span>
                    <span className="text-ink-muted no-print">
                      Click any segment to jump to its unit economics
                    </span>
                  </div>

                  <div
                    className="h-4 w-full rounded-full overflow-hidden flex bg-line/60 gap-0.5"
                    role="img"
                    aria-label={`Revenue mix across ${mixSegments.items.length} earnings divisions`}
                  >
                    {mixSegments.items.map((seg) => (
                      <button
                        key={seg.idx}
                        type="button"
                        onClick={() => focusDivision(seg.idx)}
                        style={{ width: `${Math.max(seg.normalizedWidth, 2)}%` }}
                        title={`${seg.name}: ${seg.share.toFixed(1)}% of revenue`}
                        className={`h-full ${seg.palette.bar} hover:opacity-85 transition-opacity cursor-pointer focus-visible:outline-offset-0`}
                        aria-label={`Inspect ${seg.name} (${seg.share.toFixed(1)}% of revenue)`}
                      />
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {mixSegments.items.map((seg) => (
                      <button
                        key={seg.idx}
                        type="button"
                        onClick={() => focusDivision(seg.idx)}
                        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-surface hover:bg-subtle border border-line text-xs transition-colors cursor-pointer"
                      >
                        <span className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${seg.palette.dot}`} />
                        <span className="font-medium text-ink">{seg.name}</span>
                        <span className="font-mono font-bold text-ink-secondary num">
                          {seg.share.toFixed(1).replace(/\.0$/, '')}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* At-a-Glance Earnings Divisions Table */}
              <div className="overflow-x-auto border border-line rounded-xl print-break-avoid">
                <table className="w-full text-sm text-left">
                  <thead className="bg-subtle text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-line">
                    <tr>
                      <th scope="col" className="px-4 py-3">Earnings Division</th>
                      <th scope="col" className="px-3 py-3 hidden md:table-cell">Role</th>
                      <th scope="col" className="px-3 py-3 text-right">Revenue</th>
                      <th scope="col" className="px-3 py-3 text-right">Mix</th>
                      <th scope="col" className="px-3 py-3 text-right">YoY Growth</th>
                      <th scope="col" className="px-3 py-3 text-right">Margin</th>
                      <th scope="col" className="px-4 py-3 hidden xl:table-cell">Monetization</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {divisions.map((div, idx) => {
                      const palette = DIVISION_PALETTE[idx % DIVISION_PALETTE.length];
                      const sharePct = parseNumericPct(div.revenue_share_pct);
                      const marginPct = parseNumericPct(div.margin_pct);

                      return (
                        <tr
                          key={div.name || idx}
                          onClick={() => focusDivision(idx)}
                          className="hover:bg-subtle/60 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${palette.dot}`}
                                aria-hidden="true"
                              />
                              <div className="min-w-0">
                                <span className="font-semibold text-ink block">{div.name}</span>
                                {div.reporting_basis && (
                                  <span className="text-[11px] text-ink-muted block">
                                    {div.reporting_basis}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 hidden md:table-cell whitespace-nowrap">
                            {div.strategic_role ? (
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${getRoleBadgeClass(
                                  div.strategic_role
                                )}`}
                              >
                                {div.strategic_role}
                              </span>
                            ) : (
                              <span className="text-ink-muted">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-semibold text-ink num whitespace-nowrap">
                            {div.latest_revenue || '—'}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-semibold text-ink-secondary num whitespace-nowrap">
                            {sharePct !== null ? `${sharePct.toFixed(1).replace(/\.0$/, '')}%` : '—'}
                          </td>
                          <td
                            className={`px-3 py-3 text-right font-mono text-xs font-semibold num whitespace-nowrap ${getGrowthTextClass(
                              div.yoy_growth
                            )}`}
                          >
                            {div.yoy_growth || '—'}
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">
                            {marginPct !== null ? (
                              <span
                                className={`inline-block px-2 py-0.5 rounded font-mono text-xs font-bold num border ${getMarginBadgeClass(
                                  marginPct
                                )}`}
                                title={div.margin_type || 'Segment Margin'}
                              >
                                {marginPct.toFixed(1).replace(/\.0$/, '')}%
                              </span>
                            ) : (
                              <span className="text-xs text-ink-muted">Undisclosed</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-ink-secondary hidden xl:table-cell max-w-[260px]">
                            <span className="line-clamp-2">{div.revenue_model || '—'}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Division-by-Division Collapsible Deep-Dive Cards */}
              <div className="space-y-3">
                {divisions.map((div, idx) => {
                  const isOpen = isDivisionOpen(idx);
                  const palette = DIVISION_PALETTE[idx % DIVISION_PALETTE.length];
                  const sharePct = parseNumericPct(div.revenue_share_pct);
                  const marginPct = parseNumericPct(div.margin_pct);
                  const kpis = Array.isArray(div.earnings_kpis) ? div.earnings_kpis : [];

                  return (
                    <article
                      id={`division-card-${idx}`}
                      key={div.name || idx}
                      className="rounded-xl border border-line bg-subtle/35 overflow-hidden print-break-avoid scroll-mt-36"
                    >
                      <button
                        type="button"
                        onClick={() => toggleDivision(idx)}
                        aria-expanded={isOpen}
                        className="w-full px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-left hover:bg-subtle/75 transition-colors cursor-pointer"
                      >
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span
                            className={`w-3 h-3 rounded-sm flex-shrink-0 ${palette.dot}`}
                            aria-hidden="true"
                          />
                          <h4 className="text-sm font-bold text-ink">{div.name}</h4>
                          {div.strategic_role && (
                            <span
                              className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${getRoleBadgeClass(
                                div.strategic_role
                              )}`}
                            >
                              {div.strategic_role}
                            </span>
                          )}
                          {div.reporting_basis && (
                            <span className="text-[11px] text-ink-muted hidden sm:inline">
                              · {div.reporting_basis}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5 flex-shrink-0">
                          {div.latest_revenue && (
                            <span className="font-mono text-xs font-bold text-ink num">
                              {div.latest_revenue}
                            </span>
                          )}
                          {sharePct !== null && (
                            <span className="px-2 py-0.5 rounded bg-surface border border-line font-mono text-xs font-semibold text-ink-secondary num">
                              {sharePct.toFixed(1).replace(/\.0$/, '')}% mix
                            </span>
                          )}
                          {marginPct !== null && (
                            <span
                              className={`px-2 py-0.5 rounded font-mono text-xs font-bold num border ${getMarginBadgeClass(
                                marginPct
                              )}`}
                            >
                              {marginPct.toFixed(1).replace(/\.0$/, '')}%{' '}
                              {div.margin_type?.toLowerCase().includes('gross')
                                ? 'GM'
                                : div.margin_type?.toLowerCase().includes('ebitda')
                                  ? 'EBITDA'
                                  : 'OM'}
                            </span>
                          )}
                          <span className="text-ink-muted no-print">
                            {isOpen ? (
                              <ChevronUp className="w-4 h-4" aria-hidden="true" />
                            ) : (
                              <ChevronDown className="w-4 h-4" aria-hidden="true" />
                            )}
                          </span>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4 pt-3 space-y-4 border-t border-line bg-surface/60">
                          {/* Revenue model + Profitability banner */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {div.revenue_model && (
                              <div className="px-3.5 py-2.5 rounded-lg bg-subtle/60 border border-line text-xs text-ink-secondary">
                                <span className="font-bold text-ink uppercase tracking-wider mr-1.5">
                                  Monetization Model:
                                </span>
                                <span>{div.revenue_model}</span>
                              </div>
                            )}
                            {(div.margin_summary || div.yoy_growth) && (
                              <div className="px-3.5 py-2.5 rounded-lg bg-subtle/60 border border-line text-xs text-ink-secondary">
                                <span className="font-bold text-ink uppercase tracking-wider mr-1.5">
                                  Profitability &amp; Trajectory:
                                </span>
                                <span>
                                  {[div.margin_summary, div.yoy_growth].filter(Boolean).join(' · ')}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* How It Makes Money vs. Division Unit Economics */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {div.how_it_makes_money && (
                              <div className="space-y-1">
                                <h5 className="text-xs font-bold uppercase tracking-wider text-brand">
                                  How This Division Makes Money
                                </h5>
                                <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">
                                  {div.how_it_makes_money}
                                </p>
                              </div>
                            )}

                            {div.unit_economics && (
                              <div className="space-y-1">
                                <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                  Division Unit Economics
                                </h5>
                                <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">
                                  {div.unit_economics}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Earnings Call KPIs Investors Track */}
                          {kpis.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-line">
                              <h5 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                                Key Earnings Call KPIs Analysts Track
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                                {kpis.map((kpi, kIdx) => (
                                  <div
                                    key={kpi.metric || kIdx}
                                    className="p-3 rounded-lg bg-subtle/50 border border-line space-y-1"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <span className="text-xs font-bold text-ink leading-snug">
                                        {kpi.metric}
                                      </span>
                                      {kpi.latest_value && (
                                        <span className="font-mono text-xs font-bold text-brand num whitespace-nowrap">
                                          {kpi.latest_value}
                                        </span>
                                      )}
                                    </div>
                                    {kpi.why_it_matters && (
                                      <p className="text-xs text-ink-secondary leading-relaxed">
                                        {kpi.why_it_matters}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Cross-Division Profit Pool Reality & Quarterly Earnings Watchlist */}
          {(businessModel.cross_division_synergies_and_profit_pool || watchItems.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-line print-break-avoid">
              {businessModel.cross_division_synergies_and_profit_pool && (
                <div className="p-4 rounded-xl bg-subtle/50 border border-line space-y-1.5">
                  <h3 className="text-sm font-bold text-ink">
                    Profit Pool Reality &amp; Cross-Division Flywheel
                  </h3>
                  <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">
                    {businessModel.cross_division_synergies_and_profit_pool}
                  </p>
                </div>
              )}

              {watchItems.length > 0 && (
                <div className="p-4 rounded-xl bg-subtle/50 border border-line space-y-2">
                  <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-brand" aria-hidden="true" />
                    <span>What to Watch on Earnings Day</span>
                  </h3>
                  <ul className="space-y-2">
                    {watchItems.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-sm text-ink-secondary leading-relaxed"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0 mt-2" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 5. Sources Referenced & Generation Timestamp */}
          {(sourcesReferenced.length > 0 || businessModel.generated_at) && (
            <div className="pt-3 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              {sourcesReferenced.length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                    Filings &amp; Earnings Disclosures Referenced
                  </h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {sourcesReferenced.map((src, idx) => (
                      <li
                        key={idx}
                        className="text-xs px-2.5 py-1 rounded-md bg-subtle text-ink-secondary border border-line"
                      >
                        {src}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {businessModel.generated_at && (
                <span className="text-xs font-mono text-ink-muted whitespace-nowrap self-start sm:self-end">
                  Synthesized {new Date(businessModel.generated_at).toLocaleDateString()}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
