import { useEffect } from 'react';
import { X, ShieldCheck, AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { formatLargeNumber, formatSignedCurrency, formatPercent } from '../../utils/formatters';

const AUDIT_TABS = [
  { id: 'growth', label: 'Windage Growth Rate' },
  { id: 'pe', label: 'Exit P/E Multiple' },
  { id: 'owners_value', label: "Owner's Value (10-Cap)" },
];

export default function AuditTrailDrawer({
  open,
  activeTab,
  onTabChange,
  onClose,
  report,
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !report) return null;

  const valuations = report.financials?.valuations || {};
  const windageDetails = valuations.computation_windage_details;
  const growthProjection = valuations.computation_growth_projection || windageDetails?.projection;
  const peDetails = valuations.computation_pe_details;
  const ownersValueDetails = valuations.computation_owners_value_details;

  const ocfHistory = report.financials?.raw_data?.operating_cash_flow_history || [];
  const niHistory = report.financials?.raw_data?.net_income_history || [];
  const last10Ocf = ocfHistory.slice(-10);
  const combinedHistory = last10Ocf.map((ocfItem) => {
    const niItem = niHistory.find((ni) => ni.year === ocfItem.year);
    return {
      year: ocfItem.year,
      ocfValue: ocfItem.value,
      niValue: niItem ? niItem.value : null,
    };
  });

  const fadeChartData = (growthProjection?.yearly_schedule || []).map((yr) => ({
    year: `Y${yr.year}`,
    ratePct: Number((yr.rate * 100).toFixed(2)),
    cumulativeFactor: yr.cumulative_factor,
  }));

  const handleTabKeyDown = (e, idx) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      onTabChange(AUDIT_TABS[(idx + 1) % AUDIT_TABS.length].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onTabChange(AUDIT_TABS[(idx - 1 + AUDIT_TABS.length) % AUDIT_TABS.length].id);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-drawer-title"
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm no-print"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl bg-surface border-l border-line-strong h-full flex flex-col shadow-2xl animate-slideInRight">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-line flex items-center justify-between gap-4 flex-shrink-0">
          <div>
            <h2
              id="audit-drawer-title"
              className="text-base font-bold text-ink flex items-center gap-2"
            >
              <ShieldCheck className="w-5 h-5 text-brand" aria-hidden="true" />
              <span>Calculation Transparency &amp; Audit Trail — {report.ticker}</span>
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Deterministic XBRL inputs, anchor matrices, and step-by-step valuation formulas
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close audit trail"
            className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="px-6 py-3 border-b border-line bg-subtle/50 flex-shrink-0">
          <div
            role="tablist"
            aria-label="Calculation audit sections"
            className="inline-flex flex-wrap gap-1 bg-subtle p-1 rounded-lg border border-line"
          >
            {AUDIT_TABS.map((tab, idx) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => onTabChange(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-surface text-brand shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* TAB 1: Windage Growth Rate */}
          {activeTab === 'growth' && (
            <div role="tabpanel" className="space-y-6">
              {growthProjection && (
                <>
                  <div className="p-4 rounded-xl bg-brand-soft border border-brand/20 text-xs text-ink-secondary space-y-1.5 leading-relaxed">
                    <p className="font-bold text-ink">Combined Growth Projection Methodology</p>
                    <p>
                      1. <strong>Historical Base:</strong> 10-year Operating Cash Flow CAGR (falls back to Net Income CAGR if negative).<br />
                      2. <strong>Year-1 Anchor:</strong> Minimum valid rate among Historical CAGR, Forward Consensus (<code className="font-mono bg-surface px-1 rounded">Forward P/E ÷ Forward PEG</code>), Revenue Guardrail (<code className="font-mono bg-surface px-1 rounded">Rev CAGR + 5%</code>), and 40% hyper-growth cap.<br />
                      3. <strong>10-Year Linear Fade:</strong> If Year-1 growth exceeds{' '}
                      <strong>{(growthProjection.terminal_target_rate * 100).toFixed(0)}%</strong>, linearly fades to{' '}
                      <strong>{(growthProjection.terminal_target_rate * 100).toFixed(0)}%</strong> by Year 10.
                    </p>
                  </div>

                  {/* 4-Stage Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-lg bg-subtle/60 border border-line text-center">
                      <p className="text-[11px] font-semibold uppercase text-ink-muted">1. Raw Historical</p>
                      <p className="text-lg font-bold font-mono text-ink mt-1 num">
                        {formatPercent(growthProjection.raw_historical_rate, 2)}
                      </p>
                      <p className="text-[11px] text-ink-muted truncate mt-0.5" title={growthProjection.historical_label}>
                        {growthProjection.historical_label}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-lg bg-subtle/60 border border-line text-center">
                      <p className="text-[11px] font-semibold uppercase text-ink-muted">2. Yr-1 Anchored</p>
                      <p className="text-lg font-bold font-mono text-brand mt-1 num">
                        {formatPercent(growthProjection.start_rate, 2)}
                      </p>
                      <p className="text-[11px] text-ink-muted truncate mt-0.5" title={growthProjection.anchor_label}>
                        via {growthProjection.anchor_label}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-lg bg-subtle/60 border border-line text-center">
                      <p className="text-[11px] font-semibold uppercase text-ink-muted">3. Yr-10 Terminal</p>
                      <p className="text-lg font-bold font-mono text-ink mt-1 num">
                        {formatPercent(growthProjection.terminal_rate, 2)}
                      </p>
                      <p className="text-[11px] text-ink-muted mt-0.5">
                        {growthProjection.decay_applied
                          ? `−${(growthProjection.annual_decay_step * 100).toFixed(1)}%/yr fade`
                          : 'Flat schedule'}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-lg bg-brand-soft border border-brand/25 text-center">
                      <p className="text-[11px] font-semibold uppercase text-brand">Effective 10Y CAGR</p>
                      <p className="text-lg font-bold font-mono text-brand mt-1 num">
                        {formatPercent(growthProjection.effective_cagr, 2)}
                      </p>
                      <p className="text-[11px] text-ink-secondary font-mono mt-0.5 num">
                        {growthProjection.cumulative_factor?.toFixed(2)}× over 10 yrs
                      </p>
                    </div>
                  </div>

                  {/* Step 2: Anchor Matrix */}
                  {growthProjection.anchor_candidates?.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                        Step 2: Year-1 Anchor Decision Matrix (Lowest Valid Bound)
                      </h3>
                      <div className="overflow-x-auto border border-line rounded-lg">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-subtle text-ink-muted uppercase tracking-wider border-b border-line">
                            <tr>
                              <th className="p-3">Growth Signal</th>
                              <th className="p-3">Derivation</th>
                              <th className="p-3 text-right">Implied Rate</th>
                              <th className="p-3 text-center">Decision</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {growthProjection.anchor_candidates.map((cand) => (
                              <tr
                                key={cand.key}
                                className={
                                  cand.is_selected
                                    ? 'bg-emerald-500/10 font-semibold text-ink'
                                    : 'text-ink-secondary'
                                }
                              >
                                <td className="p-3">{cand.label}</td>
                                <td className="p-3 font-mono text-ink-muted">{cand.detail}</td>
                                <td className="p-3 text-right font-mono num">
                                  {cand.available && cand.rate !== null
                                    ? formatPercent(cand.rate, 2)
                                    : '—'}
                                </td>
                                <td className="p-3 text-center">
                                  {cand.is_selected ? (
                                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold">
                                      Selected
                                    </span>
                                  ) : cand.available ? (
                                    <span className="px-2 py-0.5 rounded bg-subtle text-ink-muted">
                                      Higher
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-subtle text-ink-muted">
                                      Unavailable
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Step 3: 10-Year Growth Fade AreaChart */}
                  {fadeChartData.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                        Step 3: 10-Year Growth Fade Curve ({growthProjection.decay_applied ? 'Linear Decay' : 'Flat'})
                      </h3>
                      <div className="h-48 w-full bg-subtle/40 border border-line rounded-lg p-3">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={fadeChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                            <XAxis
                              dataKey="year"
                              tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
                              axisLine={{ stroke: 'var(--chart-grid)' }}
                              tickLine={false}
                            />
                            <YAxis
                              tickFormatter={(v) => `${v}%`}
                              tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'var(--bg-surface)',
                                borderColor: 'var(--border-strong)',
                                borderRadius: '0.5rem',
                                fontSize: '12px',
                                color: 'var(--text-primary)',
                              }}
                              formatter={(val, name, props) => [
                                `${val}% (${props.payload.cumulativeFactor?.toFixed(2)}× cumul.)`,
                                'Annual Growth Rate',
                              ]}
                            />
                            <ReferenceLine
                              y={Number((growthProjection.terminal_target_rate * 100).toFixed(1))}
                              stroke="#94a3b8"
                              strokeDasharray="4 4"
                            />
                            <Area
                              type="monotone"
                              dataKey="ratePct"
                              stroke="#2563eb"
                              strokeWidth={2}
                              fill="#3b82f6"
                              fillOpacity={0.16}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Step 1: Historical Base Audit */}
              {valuations.windage_fallback_message ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Step 1: OCF CAGR Fallback Triggered</span>
                    </div>
                    <p className="text-xs text-ink-secondary leading-relaxed">
                      {report.financials?.derived_metrics?.computation_windage ||
                        'OCF CAGR was negative or undefined; fell back to Net Income growth rate.'}
                    </p>
                  </div>

                  <div className="overflow-x-auto border border-line rounded-lg">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-subtle text-ink-muted uppercase tracking-wider border-b border-line">
                        <tr>
                          <th className="p-3">Year</th>
                          <th className="p-3 text-right">Operating Cash Flow</th>
                          <th className="p-3 text-right">Net Income</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {combinedHistory.map((item, idx) => (
                          <tr key={idx} className="hover:bg-subtle/60 text-ink-secondary">
                            <td className="p-3 font-mono font-medium text-ink">{item.year}</td>
                            <td className="p-3 text-right font-mono num">
                              {formatSignedCurrency(item.ocfValue)}
                            </td>
                            <td className="p-3 text-right font-mono num text-amber-700 dark:text-amber-400 font-semibold">
                              {item.niValue !== null ? formatSignedCurrency(item.niValue) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : windageDetails?.is_cagr ? (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                    Step 1: Historical Operating Cash Flow CAGR ({windageDetails.start_year}–{windageDetails.end_year})
                  </h3>
                  <div className="overflow-x-auto border border-line rounded-lg">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-subtle text-ink-muted uppercase tracking-wider border-b border-line">
                        <tr>
                          <th className="p-3">Year</th>
                          <th className="p-3 text-right">Operating Cash Flow</th>
                          <th className="p-3 text-right">Net Income</th>
                          <th className="p-3 text-center">Role</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {combinedHistory.map((item, idx) => {
                          const isStart = item.year === windageDetails.start_year;
                          const isEnd = item.year === windageDetails.end_year;
                          return (
                            <tr
                              key={idx}
                              className={
                                isStart || isEnd
                                  ? 'bg-brand-soft/60 font-semibold text-ink'
                                  : 'text-ink-secondary'
                              }
                            >
                              <td className="p-3 font-mono">{item.year}</td>
                              <td className="p-3 text-right font-mono num">
                                {formatSignedCurrency(item.ocfValue)}
                              </td>
                              <td className="p-3 text-right font-mono num text-ink-muted">
                                {item.niValue !== null ? formatSignedCurrency(item.niValue) : '—'}
                              </td>
                              <td className="p-3 text-center">
                                {isStart ? (
                                  <span className="px-2 py-0.5 rounded bg-brand-soft text-brand font-bold">
                                    Start Year
                                  </span>
                                ) : isEnd ? (
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold">
                                    End Year
                                  </span>
                                ) : (
                                  <span className="text-ink-muted">Reference</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 2: Exit P/E Multiple */}
          {activeTab === 'pe' && (
            <div role="tabpanel" className="space-y-6">
              <div className="p-4 rounded-xl bg-brand-soft border border-brand/20 text-xs text-ink-secondary leading-relaxed space-y-1">
                <p className="font-bold text-ink">Year-10 Conservative Exit P/E Rule</p>
                <p>
                  Formula:{' '}
                  <code className="font-mono bg-surface px-1.5 py-0.5 rounded text-ink">
                    min(5Y Median P/E, 2 × Year-10 Terminal Growth, {(peDetails?.terminal_pe_cap ?? 30).toFixed(0)}x Cap)
                  </code>{' '}
                  → Selected:{' '}
                  <strong className="text-brand font-mono">{peDetails?.final_pe?.toFixed(2)}x</strong>
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                    Historical 5-Year Annual P/E Series
                  </h3>
                  <div className="bg-subtle/60 border border-line rounded-lg divide-y divide-line">
                    {peDetails?.last_5_years_pe?.length > 0 ? (
                      peDetails.last_5_years_pe.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center px-3.5 py-2.5 text-xs"
                        >
                          <span className="font-mono text-ink-secondary">{item.date}</span>
                          <span className="font-mono font-bold text-ink num">
                            {item.pe?.toFixed(2)}x
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="p-4 text-xs text-ink-muted">
                        No historical annual P/E series available; using {peDetails?.pe_source || 'fallback P/E'}.
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                    Decision Matrix (Minimum Wins)
                  </h3>
                  <div className="space-y-2.5">
                    {[
                      {
                        key: 'median_pe_5yr',
                        title: peDetails?.pe_source || '5-Year Median P/E',
                        subtitle: `Suppresses 1-yr spikes (5Y Max: ${peDetails?.max_pe_5yr?.toFixed(2) ?? '—'}x)`,
                        value: (peDetails?.median_pe_5yr ?? peDetails?.max_pe_5yr)?.toFixed(2),
                      },
                      {
                        key: 'two_x_terminal_growth',
                        title: '2× Year-10 Terminal Growth',
                        subtitle: `${((peDetails?.terminal_growth_rate ?? growthProjection?.terminal_rate ?? 0) * 100).toFixed(2)}% × 2`,
                        value: peDetails?.two_x_growth?.toFixed(2),
                      },
                      {
                        key: 'terminal_pe_cap',
                        title: 'Mature Exit P/E Cap',
                        subtitle: 'Hard ceiling for Year-10 exit multiple',
                        value: (peDetails?.terminal_pe_cap ?? 30).toFixed(2),
                      },
                    ].map((row) => {
                      const selected = peDetails?.selected_bound === row.key;
                      return (
                        <div
                          key={row.key}
                          className={`p-3.5 rounded-lg border flex justify-between items-center text-xs ${
                            selected
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : 'bg-surface border-line'
                          }`}
                        >
                          <div>
                            <p className="font-semibold text-ink flex items-center gap-2">
                              <span>{row.title}</span>
                              {selected && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
                                  Selected
                                </span>
                              )}
                            </p>
                            <p className="text-ink-muted mt-0.5">{row.subtitle}</p>
                          </div>
                          <span className="text-base font-bold font-mono text-ink num">
                            {row.value ? `${row.value}x` : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Owner's Value (10-Cap) */}
          {activeTab === 'owners_value' && (
            <div role="tabpanel" className="space-y-6">
              <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/25 text-xs text-ink-secondary leading-relaxed space-y-1">
                <p className="font-bold text-ink">Buffett 10-Cap Owner Earnings Derivation</p>
                <p>
                  <code className="font-mono bg-surface px-1.5 py-0.5 rounded text-ink">
                    Owner Earnings = Net Income + D&amp;A − ΔWorking Capital − |CapEx|
                  </code>
                </p>
                <p>
                  Positive ΔWC uses cash (reduces Owner Earnings); negative ΔWC releases cash (increases Owner Earnings).
                </p>
              </div>

              {/* 5 Component Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: 'Net Income', val: ownersValueDetails?.net_income ?? 0 },
                  { label: '+ D&A', val: ownersValueDetails?.depreciation_amortization ?? 0 },
                  {
                    label: '− ΔWC',
                    val: ownersValueDetails?.working_capital_change ?? 0,
                    sub:
                      ownersValueDetails?.working_capital_source === 'balance_sheet'
                        ? 'Balance Sheet'
                        : ownersValueDetails?.working_capital_source === 'cash_flow'
                          ? 'Cash Flow XBRL'
                          : 'Not cached ($0)',
                  },
                  { label: '− CapEx', val: ownersValueDetails?.capex ?? 0 },
                  {
                    label: '= Owner Earnings',
                    val: ownersValueDetails?.owner_earnings ?? 0,
                    highlight: true,
                  },
                ].map((c) => (
                  <div
                    key={c.label}
                    className={`p-3 rounded-lg border text-center ${
                      c.highlight
                        ? 'bg-violet-500/10 border-violet-500/30 col-span-2 sm:col-span-1'
                        : 'bg-subtle/60 border-line'
                    }`}
                  >
                    <p className="text-[11px] font-semibold uppercase text-ink-muted">{c.label}</p>
                    <p className="text-base font-bold font-mono text-ink mt-1 num">
                      {formatSignedCurrency(c.val)}
                    </p>
                    {c.sub && <p className="text-[11px] text-ink-muted mt-0.5">{c.sub}</p>}
                  </div>
                ))}
              </div>

              {/* Historical Owner Earnings 10Y Table */}
              {ownersValueDetails?.history?.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                    Historical Owner Earnings &amp; 10-Cap Value (Last 10 Years)
                  </h3>
                  <div className="overflow-x-auto border border-line rounded-lg">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-subtle text-ink-muted uppercase tracking-wider border-b border-line">
                        <tr>
                          <th className="p-2.5">Year</th>
                          <th className="p-2.5 text-right">Net Inc.</th>
                          <th className="p-2.5 text-right">+ D&amp;A</th>
                          <th className="p-2.5 text-right">− ΔWC</th>
                          <th className="p-2.5 text-right">− CapEx</th>
                          <th className="p-2.5 text-right">Owner Earn.</th>
                          <th className="p-2.5 text-right">10-Cap (10×)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {ownersValueDetails.history.map((row, idx) => {
                          const isLatest = String(row.year) === String(ownersValueDetails.fiscal_year);
                          return (
                            <tr
                              key={idx}
                              className={
                                isLatest
                                  ? 'bg-violet-500/10 font-semibold text-ink'
                                  : 'text-ink-secondary hover:bg-subtle/60'
                              }
                            >
                              <td className="p-2.5 font-mono">
                                {row.year}
                                {isLatest && (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-700 dark:text-violet-300 text-[10px] font-bold">
                                    FY
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-right font-mono num">
                                {formatSignedCurrency(row.net_income)}
                              </td>
                              <td className="p-2.5 text-right font-mono num">
                                {formatSignedCurrency(row.da)}
                              </td>
                              <td className="p-2.5 text-right font-mono num">
                                {formatSignedCurrency(row.working_capital_change ?? 0)}
                              </td>
                              <td className="p-2.5 text-right font-mono num">
                                {formatSignedCurrency(row.capex)}
                              </td>
                              <td
                                className={`p-2.5 text-right font-mono font-bold num ${
                                  row.owner_earnings > 0
                                    ? 'text-violet-600 dark:text-violet-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {formatSignedCurrency(row.owner_earnings)}
                              </td>
                              <td className="p-2.5 text-right font-mono num">
                                {row.owners_value > 0 ? `$${formatLargeNumber(row.owners_value)}` : 'N/A'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
