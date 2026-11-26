import { useState, useMemo } from 'react';
import {
  Info,
  TrendingUp,
  ArrowUpRight,
  SlidersHorizontal,
  RotateCcw,
  BarChart3,
  Table2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import InfoTooltip from '../ui/InfoTooltip';
import {
  formatLargeNumber,
  formatSignedCurrency,
  formatPrice,
  formatPercent,
  computeValuationDelta,
} from '../../utils/formatters';
import { computeWhatIfValuation } from '../../utils/valuationHelpers';

export default function ValuationSuite({ report, onOpenAudit }) {
  const valuations = report.financials?.valuations || {};
  const derived = report.financials?.derived_metrics || {};
  const windageDetails = valuations.computation_windage_details;
  const growthProjection = valuations.computation_growth_projection || windageDetails?.projection;
  const peDetails = valuations.computation_pe_details;
  const mosDetails = valuations.computation_mos_details;
  const ownersValueDetails = valuations.computation_owners_value_details;

  const [paybackView, setPaybackView] = useState('chart'); // 'chart' | 'table'
  const [whatIfOpen, setWhatIfOpen] = useState(false);

  // Baseline parameters for What-If sensitivity sliders
  const defaultGrPct = Number(
    ((valuations.windage_growth_rate_used ?? 0.12) * 100).toFixed(1)
  );
  const defaultPe = Number((peDetails?.final_pe ?? valuations.windage_pe_used ?? 20).toFixed(1));
  const defaultMarrPct = Number(((valuations.marr_used ?? 0.15) * 100).toFixed(0));

  const [simGrPct, setSimGrPct] = useState(defaultGrPct);
  const [simPe, setSimPe] = useState(defaultPe);
  const [simMarrPct, setSimMarrPct] = useState(defaultMarrPct);

  // Starting FCF for What-If sensitivity workbench (prefers TTM FCF when available)
  const latestFcf =
    valuations.payback_starting_fcf ??
    derived.computation_rule_of_40_details?.latest_fcf ??
    (valuations.projected_fcf_per_year?.[0]
      ? valuations.projected_fcf_per_year[0].fcf /
        (1 + (valuations.projected_fcf_per_year[0].growth_rate ?? valuations.windage_growth_rate_used ?? 0))
      : 0);
  const paybackFcfBasis = valuations.payback_fcf_basis || 'FY';
  const paybackIsTtm = paybackFcfBasis === 'TTM';
  const paybackFcfLabel = valuations.payback_fcf_label || (paybackIsTtm ? 'TTM' : 'FY');

  const r40Details = derived.computation_rule_of_40_details;
  const r40IsTtm = r40Details?.basis === 'TTM';
  const r40Label = r40Details?.latest_year || (r40IsTtm ? 'TTM' : 'FY');

  const currentEps = mosDetails?.current_eps ?? 0;
  const sharesOut = ownersValueDetails?.shares_outstanding ?? 0;
  const marketCap = valuations.market_cap ?? 0;
  const currentPrice = report.price_at_storage ?? 0;

  const whatIf = useMemo(
    () =>
      computeWhatIfValuation({
        currentEps,
        latestFcf,
        marketCap,
        sharesOutstanding: sharesOut,
        growthRate: simGrPct / 100,
        exitPe: simPe,
        marr: simMarrPct / 100,
      }),
    [currentEps, latestFcf, marketCap, sharesOut, simGrPct, simPe, simMarrPct]
  );

  const simDelta = computeValuationDelta(whatIf.mosPrice, currentPrice);
  const isModified =
    Math.abs(simGrPct - defaultGrPct) > 0.05 ||
    Math.abs(simPe - defaultPe) > 0.05 ||
    Math.abs(simMarrPct - defaultMarrPct) > 0.05;

  const resetWhatIf = () => {
    setSimGrPct(defaultGrPct);
    setSimPe(defaultPe);
    setSimMarrPct(defaultMarrPct);
  };

  // Prepare Payback Chart data
  const paybackChartData = (valuations.projected_fcf_per_year || []).map((p) => ({
    year: `Y${p.year}`,
    fcf: p.fcf,
    cumulative: p.cumulative_fcf,
    growthPct: Number(((p.growth_rate ?? valuations.windage_growth_rate_used ?? 0) * 100).toFixed(1)),
    isPayback: p.is_payback_year || (valuations.payback_time_years > 0 && p.year === valuations.payback_time_years),
  }));

  return (
    <section id="section-valuations" className="space-y-6 scroll-mt-32">
      {/* Section Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink tracking-tight">
            Valuation Models &amp; Intrinsic Pricing
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Three independent value-investing frameworks sharing deterministic SEC XBRL and cash-flow assumptions
          </p>
        </div>

        <button
          type="button"
          onClick={() => setWhatIfOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 rounded-lg text-xs font-semibold border border-line-strong bg-surface hover:bg-subtle text-ink transition-colors cursor-pointer no-print"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-brand" aria-hidden="true" />
          <span>What-If Sensitivity</span>
          {whatIfOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-ink-muted" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-ink-muted" />
          )}
        </button>
      </div>

      {/* Consolidated Shared Valuation Assumptions Banner (replaces duplicated banners in MOS & Payback) */}
      {(valuations.windage_fallback_message ||
        (growthProjection && (growthProjection.was_anchored || growthProjection.decay_applied))) && (
        <div className="bg-surface border border-line rounded-xl p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink">
              <TrendingUp className="w-4 h-4 text-brand flex-shrink-0" aria-hidden="true" />
              <span>Shared 10-Year Growth Model (MOS &amp; Payback Time)</span>
              <InfoTooltip term="windageGr" />
            </div>

            {growthProjection && (
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono num">
                <span className="px-2 py-0.5 rounded bg-brand-soft text-brand font-semibold">
                  {growthProjection.decay_applied
                    ? `Fade ${formatPercent(growthProjection.start_rate)} → ${formatPercent(growthProjection.terminal_rate)}`
                    : `Flat ${formatPercent(growthProjection.start_rate)}`}
                </span>
                <span className="px-2 py-0.5 rounded bg-subtle text-ink-secondary border border-line">
                  Eff. 10Y CAGR: {formatPercent(growthProjection.effective_cagr)}
                </span>
              </div>
            )}
          </div>

          {valuations.windage_fallback_message && (
            <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>{valuations.windage_fallback_message}</span>
            </div>
          )}

          {growthProjection?.adjustment_summary &&
            (growthProjection.was_anchored || growthProjection.decay_applied) && (
              <p className="text-xs text-ink-secondary leading-relaxed">
                {growthProjection.adjustment_summary}
              </p>
            )}
        </div>
      )}

      {/* Collapsible Interactive What-If Sensitivity Workbench */}
      {whatIfOpen && (
        <div className="bg-surface border border-brand/30 rounded-xl p-5 space-y-4 animate-fadeIn no-print">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <div>
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-brand" aria-hidden="true" />
                <span>Interactive What-If Scenario Stress Test</span>
              </h3>
              <p className="text-xs text-ink-muted mt-0.5">
                Adjust growth, exit multiple, or required return (MARR) to stress-test intrinsic value locally.
              </p>
            </div>
            {isModified && (
              <button
                type="button"
                onClick={resetWhatIf}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-subtle hover:bg-line text-ink-secondary transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reset to Model Defaults</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Sliders */}
            <div className="lg:col-span-7 space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="sim-gr" className="font-medium text-ink-secondary">
                    Assumed 10Y Growth Rate
                  </label>
                  <span className="font-mono font-bold text-ink num">{simGrPct.toFixed(1)}%</span>
                </div>
                <input
                  id="sim-gr"
                  type="range"
                  min={0}
                  max={40}
                  step={0.5}
                  value={simGrPct}
                  onChange={(e) => setSimGrPct(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="sim-pe" className="font-medium text-ink-secondary">
                    Year-10 Exit P/E Multiple
                  </label>
                  <span className="font-mono font-bold text-ink num">{simPe.toFixed(1)}x</span>
                </div>
                <input
                  id="sim-pe"
                  type="range"
                  min={5}
                  max={40}
                  step={0.5}
                  value={simPe}
                  onChange={(e) => setSimPe(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="sim-marr" className="font-medium text-ink-secondary">
                    Target Annual Return (MARR)
                  </label>
                  <span className="font-mono font-bold text-ink num">{simMarrPct}%</span>
                </div>
                <input
                  id="sim-marr"
                  type="range"
                  min={8}
                  max={25}
                  step={1}
                  value={simMarrPct}
                  onChange={(e) => setSimMarrPct(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Live Simulated Outputs */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-lg bg-subtle border border-line">
                <span className="text-xs text-ink-muted block">Simulated MOS Buy</span>
                <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 num block mt-0.5">
                  {currentEps > 0 ? formatPrice(whatIf.mosPrice) : 'N/A'}
                </span>
                {simDelta && (
                  <span className="text-xs text-ink-muted block mt-1">{simDelta.shortBadge}</span>
                )}
              </div>

              <div className="p-3.5 rounded-lg bg-subtle border border-line">
                <span className="text-xs text-ink-muted block">Simulated Sticker</span>
                <span className="text-xl font-bold font-mono text-ink num block mt-0.5">
                  {currentEps > 0 ? formatPrice(whatIf.stickerPrice) : 'N/A'}
                </span>
                <span className="text-xs text-ink-muted block mt-1 font-mono num">
                  Yr-10 EPS {formatPrice(whatIf.futureEps)}
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-subtle border border-line">
                <span className="text-xs text-ink-muted block">Simulated Payback</span>
                <span className="text-lg font-bold font-mono text-ink num block mt-0.5">
                  {latestFcf > 0
                    ? whatIf.paybackYears > 0
                      ? `${whatIf.paybackYears} Years`
                      : '10+ Years'
                    : 'N/A'}
                </span>
                <span className="text-xs text-ink-muted block mt-1 font-mono num">
                  Base: {paybackFcfLabel} FCF
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-subtle border border-line">
                <span className="text-xs text-ink-muted block">Implied Yr-10 Mkt Cap</span>
                <span className="text-lg font-bold font-mono text-ink num block mt-0.5">
                  {whatIf.impliedMarketCap > 0
                    ? `$${formatLargeNumber(whatIf.impliedMarketCap)}`
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Three Core Valuation Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Card 1: Margin of Safety */}
        <article className="cq-card bg-surface border border-line rounded-xl p-5 flex flex-col justify-between gap-4 print-break-avoid">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
              <h3 className="text-base font-bold text-ink inline-flex items-center gap-1.5">
                <span>Margin of Safety</span>
                <InfoTooltip term="mos" />
              </h3>
              <button
                type="button"
                onClick={() => onOpenAudit('pe')}
                className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-0.5 cursor-pointer no-print"
              >
                <span>Derivation</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Key Value Block */}
            <div className="p-4 rounded-lg bg-subtle border border-line flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted block">
                  MOS Buy Price
                </span>
                <span className="text-3xl font-bold font-mono text-emerald-600 dark:text-emerald-400 num">
                  {valuations.margin_of_safety_price > 0
                    ? formatPrice(valuations.margin_of_safety_price)
                    : 'N/A'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-ink-muted inline-flex items-center gap-1">
                  <span>Sticker Price</span>
                  <InfoTooltip term="sticker" />
                </span>
                <span className="text-lg font-bold font-mono text-ink block num">
                  {valuations.margin_of_safety_price > 0
                    ? formatPrice(valuations.margin_of_safety_price * 2)
                    : 'N/A'}
                </span>
              </div>
            </div>

            {/* Model Inputs Strip */}
            {growthProjection && peDetails && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-lg bg-subtle/60 border border-line">
                  <span className="text-[11px] font-medium text-ink-muted block">Eff. 10Y GR</span>
                  <span className="text-sm font-bold font-mono text-ink num">
                    {formatPercent(growthProjection.effective_cagr)}
                  </span>
                  <span className="text-[11px] text-ink-muted block truncate">
                    Raw {formatPercent(growthProjection.raw_historical_rate)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-subtle/60 border border-line">
                  <span className="text-[11px] font-medium text-ink-muted block">Yr-1 Anchor</span>
                  <span className="text-sm font-bold font-mono text-ink num">
                    {formatPercent(growthProjection.start_rate)}
                  </span>
                  <span
                    className="text-[11px] text-ink-muted block truncate"
                    title={growthProjection.anchor_label}
                  >
                    {growthProjection.anchor_key === 'forward_consensus'
                      ? 'Fwd Est.'
                      : growthProjection.anchor_key === 'revenue_guardrail'
                        ? 'Rev +5%'
                        : growthProjection.anchor_key === 'hyper_growth_cap'
                          ? '40% Cap'
                          : 'Hist. CAGR'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-subtle/60 border border-line">
                  <span className="text-[11px] font-medium text-ink-muted inline-flex items-center gap-0.5">
                    <span>Exit P/E</span>
                    <InfoTooltip term="exitPe" />
                  </span>
                  <span className="text-sm font-bold font-mono text-ink block num">
                    {peDetails.final_pe?.toFixed(1)}x
                  </span>
                  <span
                    className="text-[11px] text-ink-muted block truncate"
                    title={peDetails.selected_bound_label}
                  >
                    {peDetails.selected_bound === 'two_x_terminal_growth'
                      ? `2× Yr-10`
                      : peDetails.selected_bound === 'median_pe_5yr'
                        ? '5Y Med'
                        : `${peDetails.terminal_pe_cap?.toFixed(0) || 30}x Cap`}
                  </span>
                </div>
              </div>
            )}

            {/* Step-by-Step Math */}
            {mosDetails && (
              <ol className="space-y-2">
                {[
                  { n: 1, title: 'Future EPS (10 Years)', body: mosDetails.step_1_future_eps },
                  { n: 2, title: 'Future Price Estimate', body: mosDetails.step_2_future_price },
                  { n: 3, title: 'Sticker Price (15% MARR)', body: mosDetails.step_3_sticker_price },
                  {
                    n: 4,
                    title: 'Apply 50% Margin of Safety',
                    body: mosDetails.step_4_mos_price,
                    highlight: true,
                  },
                ].map((step) => (
                  <li
                    key={step.n}
                    className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                      step.highlight
                        ? 'bg-emerald-500/5 border-emerald-500/25'
                        : 'bg-subtle/50 border-line'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        step.highlight
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                          : 'bg-brand-soft text-brand'
                      }`}
                    >
                      {step.n}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-ink">{step.title}</p>
                      <p className="text-xs font-mono text-ink-muted mt-0.5 break-words leading-relaxed">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {mosDetails?.implied_future_market_cap > 0 && (
            <div className="flex justify-between items-center px-3 py-2 bg-subtle/60 rounded-lg border border-line text-xs">
              <span className="text-ink-muted">Implied Yr-10 Market Cap</span>
              <span className="font-mono font-semibold text-ink num">
                ${formatLargeNumber(mosDetails.implied_future_market_cap)}
              </span>
            </div>
          )}
        </article>

        {/* Card 2: Payback Time */}
        <article className="cq-card bg-surface border border-line rounded-xl p-5 flex flex-col justify-between gap-4 print-break-avoid">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
              <h3 className="text-base font-bold text-ink inline-flex items-center gap-1.5">
                <span>Payback Time</span>
                <InfoTooltip term="payback" />
              </h3>

              {/* Chart / Table Toggle */}
              {paybackChartData.length > 0 && (
                <div className="inline-flex rounded-lg bg-subtle p-0.5 border border-line no-print">
                  <button
                    type="button"
                    onClick={() => setPaybackView('chart')}
                    aria-label="Chart view"
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      paybackView === 'chart'
                        ? 'bg-surface text-ink shadow-sm'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Chart</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaybackView('table')}
                    aria-label="Table view"
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      paybackView === 'table'
                        ? 'bg-surface text-ink shadow-sm'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    <Table2 className="w-3.5 h-3.5" />
                    <span>Table</span>
                  </button>
                </div>
              )}
            </div>

            {/* Key Value Block */}
            <div className="p-4 rounded-lg bg-subtle border border-line flex items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    Principal Recovery
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                      paybackIsTtm
                        ? 'bg-sky-500/10 border-sky-500/25 text-sky-700 dark:text-sky-300'
                        : 'bg-surface border-line text-ink-muted'
                    }`}
                  >
                    {paybackFcfLabel} FCF
                  </span>
                </div>
                <span className="text-3xl font-bold font-mono text-brand num">
                  {valuations.payback_time_years > 0
                    ? `${valuations.payback_time_years} Yrs`
                    : '10+ Yrs'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-ink-muted block">Rule #1 Hurdle</span>
                <span
                  className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-md text-xs font-bold ${
                    valuations.payback_time_years > 0 && valuations.payback_time_years <= 8
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {valuations.payback_time_years > 0 && valuations.payback_time_years <= 8
                    ? 'PASS (≤ 8 Yrs)'
                    : 'FAIL (> 8 Yrs)'}
                </span>
              </div>
            </div>

            {/* Interactive Chart OR 10Y Table */}
            {paybackChartData.length > 0 ? (
              paybackView === 'chart' ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-ink-muted">
                    <span className="font-mono num">
                      Start FCF ({paybackFcfLabel}): {formatSignedCurrency(latestFcf)}
                    </span>
                    <span className="font-mono num">
                      Mkt Cap: ${formatLargeNumber(marketCap)}
                    </span>
                  </div>
                  <div className="h-56 w-full bg-subtle/40 border border-line rounded-lg p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={paybackChartData}
                        margin={{ top: 10, right: 8, left: -12, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                        <XAxis
                          dataKey="year"
                          tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
                          axisLine={{ stroke: 'var(--chart-grid)' }}
                          tickLine={false}
                        />
                        <YAxis
                          tickFormatter={(v) => `$${formatLargeNumber(v)}`}
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
                          formatter={(val, name) => [
                            formatSignedCurrency(val),
                            name === 'fcf' ? 'Annual FCF' : 'Cumulative FCF',
                          ]}
                        />
                        {marketCap > 0 && (
                          <ReferenceLine
                            y={marketCap}
                            stroke="#f59e0b"
                            strokeDasharray="4 4"
                            strokeWidth={1.75}
                            label={{
                              value: 'Market Cap',
                              position: 'insideTopRight',
                              fill: '#f59e0b',
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          />
                        )}
                        <Bar
                          dataKey="fcf"
                          fill="#3b82f6"
                          fillOpacity={0.75}
                          radius={[3, 3, 0, 0]}
                          maxBarSize={24}
                        />
                        <Line
                          type="monotone"
                          dataKey="cumulative"
                          stroke="#10b981"
                          strokeWidth={2.25}
                          dot={{ r: 3, fill: '#10b981' }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto custom-scrollbar border border-line rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-subtle text-ink-muted sticky top-0 border-b border-line">
                      <tr>
                        <th className="p-2 text-center font-semibold">Yr</th>
                        <th className="p-2 text-right font-semibold">GR</th>
                        <th className="p-2 text-right font-semibold">Proj. FCF</th>
                        <th className="p-2 text-right font-semibold">Cumul. FCF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {valuations.projected_fcf_per_year.map((proj) => {
                        const isPaybackRow =
                          proj.is_payback_year ||
                          (valuations.payback_time_years > 0 &&
                            proj.year === valuations.payback_time_years);
                        return (
                          <tr
                            key={proj.year}
                            className={
                              isPaybackRow
                                ? 'bg-emerald-500/10 font-semibold text-emerald-700 dark:text-emerald-400'
                                : 'hover:bg-subtle/60 text-ink-secondary'
                            }
                          >
                            <td className="p-2 text-center font-mono num">{proj.year}</td>
                            <td className="p-2 text-right font-mono num text-brand">
                              {formatPercent(
                                proj.growth_rate ?? valuations.windage_growth_rate_used,
                                1
                              )}
                            </td>
                            <td className="p-2 text-right font-mono num">
                              {formatSignedCurrency(proj.fcf)}
                            </td>
                            <td className="p-2 text-right font-mono num">
                              {proj.cumulative_fcf !== undefined
                                ? formatSignedCurrency(proj.cumulative_fcf)
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <div className="p-4 rounded-lg bg-subtle/60 border border-line text-xs text-ink-muted">
                {paybackFcfLabel} Free Cash Flow ({formatSignedCurrency(latestFcf)}) is zero or negative; a positive FCF payback projection cannot be computed.
              </div>
            )}
          </div>

          {valuations.computation_payback_details && (
            <div className="p-3 rounded-lg bg-subtle/60 border border-line text-xs text-ink-secondary whitespace-pre-wrap leading-relaxed">
              {valuations.computation_payback_details}
            </div>
          )}
        </article>

        {/* Card 3: Owner's Value (10-Cap) */}
        <article className="cq-card bg-surface border border-line rounded-xl p-5 flex flex-col justify-between gap-4 print-break-avoid">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
              <h3 className="text-base font-bold text-ink inline-flex items-center gap-1.5">
                <span>Owner&apos;s Value (10-Cap)</span>
                <InfoTooltip term="ownersValue" />
              </h3>
              <button
                type="button"
                onClick={() => onOpenAudit('owners_value')}
                className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-0.5 cursor-pointer no-print"
              >
                <span>XBRL Math</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {ownersValueDetails && !ownersValueDetails.has_working_capital_data && (
              <div className="flex items-start gap-2 text-xs text-brand bg-brand-soft border border-brand/20 rounded-lg px-3 py-2">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  ΔWorking Capital not cached ($0 used). Click <strong>Refresh Fresh</strong> to
                  extract SEC XBRL working capital.
                </span>
              </div>
            )}

            {/* Key Value Block */}
            <div className="p-4 rounded-lg bg-subtle border border-line flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted block">
                  {valuations.owners_value_per_share > 0
                    ? `10-Cap / Share · FY ${ownersValueDetails?.fiscal_year || 'TTM'}`
                    : `Owner's Value · FY ${ownersValueDetails?.fiscal_year || 'TTM'}`}
                </span>
                <span className="text-3xl font-bold font-mono text-violet-600 dark:text-violet-400 num">
                  {valuations.owners_value > 0
                    ? valuations.owners_value_per_share > 0
                      ? formatPrice(valuations.owners_value_per_share)
                      : `$${formatLargeNumber(valuations.owners_value)}`
                    : 'N/A'}
                </span>
                {valuations.owners_value > 0 && valuations.owners_value_per_share > 0 && (
                  <span className="text-xs font-mono text-ink-muted block mt-0.5 num">
                    Total: ${formatLargeNumber(valuations.owners_value)}
                  </span>
                )}
              </div>

              <div className="text-right">
                <span className="text-xs text-ink-muted block">Cap Rate</span>
                <span
                  className={`text-lg font-bold font-mono num ${
                    valuations.cap_rate >= 0.1
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {valuations.owners_value > 0 && marketCap > 0
                    ? formatPercent(valuations.cap_rate, 1)
                    : 'N/A'}
                </span>
                <span className="text-[11px] font-semibold text-ink-muted block">
                  {ownersValueDetails?.is_undervalued ? 'Pass (≥10%)' : 'Target ≥10%'}
                </span>
              </div>
            </div>

            {/* Step-by-Step Owner Earnings Math */}
            {ownersValueDetails?.steps && (
              <ol className="space-y-2">
                {[
                  {
                    n: 1,
                    title: `Owner Earnings (${ownersValueDetails.fiscal_year})`,
                    body: ownersValueDetails.steps.step_1_owner_earnings,
                  },
                  {
                    n: 2,
                    title: "Owner's Value (10× Yield)",
                    body: ownersValueDetails.steps.step_2_owners_value,
                  },
                  {
                    n: 3,
                    title: 'Per-Share Valuation',
                    body: ownersValueDetails.steps.step_3_per_share,
                  },
                  {
                    n: 4,
                    title: 'Cap Rate vs. Market Cap',
                    body: ownersValueDetails.steps.step_4_cap_rate,
                    highlight: ownersValueDetails.is_undervalued,
                  },
                ].map((step) => (
                  <li
                    key={step.n}
                    className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                      step.highlight
                        ? 'bg-emerald-500/5 border-emerald-500/25'
                        : 'bg-subtle/50 border-line'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        step.highlight
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                          : 'bg-violet-500/15 text-violet-700 dark:text-violet-400'
                      }`}
                    >
                      {step.n}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-ink">{step.title}</p>
                      <p className="text-xs font-mono text-ink-muted mt-0.5 break-words leading-relaxed">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="flex justify-between items-center px-3 py-2 bg-subtle/60 rounded-lg border border-line text-xs">
            <span className="text-ink-muted">Price / Owner Earnings</span>
            <span className="font-mono font-semibold text-ink num">
              {(ownersValueDetails?.price_to_owner_earnings ?? 0) > 0
                ? `${ownersValueDetails.price_to_owner_earnings.toFixed(1)}x (Target ≤10x)`
                : 'N/A'}
            </span>
          </div>
        </article>
      </div>

      {/* Alternative Valuation Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print-break-avoid">
        {/* Rule of 40 */}
        <div className="bg-surface border border-line rounded-xl p-5 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-ink inline-flex flex-wrap items-center gap-1.5">
                <span>Rule of 40</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold border ${
                    r40IsTtm
                      ? 'bg-sky-500/10 border-sky-500/25 text-sky-700 dark:text-sky-300'
                      : 'bg-subtle border-line text-ink-muted'
                  }`}
                >
                  {r40IsTtm ? r40Label : `FY ${r40Label}`}
                </span>
                <InfoTooltip term="ruleOf40" />
              </h3>
              <p className="text-xs text-ink-muted mt-0.5">
                {r40IsTtm
                  ? 'TTM YoY Revenue Growth + TTM FCF Margin'
                  : '1Y Revenue Growth + FCF Margin'}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`text-2xl font-bold font-mono num ${
                  derived.rule_of_40 >= 40
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {derived.rule_of_40 !== undefined ? derived.rule_of_40.toFixed(1) : '—'}
              </span>
              <span className="text-xs text-ink-muted block">
                {derived.rule_of_40 >= 40 ? 'Pass (≥ 40)' : 'Below 40'}
              </span>
            </div>
          </div>

          {r40Details && (
            <div className="p-3 rounded-lg bg-subtle/70 border border-line text-xs space-y-1">
              <p className="text-ink-secondary">{r40Details.explanation}</p>
              <p className="font-mono text-ink num">
                {formatPercent(r40Details.revenue_growth_1yr, 1)}{' '}
                <span className="text-ink-muted">
                  ({r40IsTtm ? 'TTM ' : ''}Rev {formatSignedCurrency(r40Details.latest_revenue)})
                </span>{' '}
                + {formatPercent(r40Details.fcf_margin, 1)}{' '}
                <span className="text-ink-muted">
                  ({r40IsTtm ? 'TTM ' : ''}FCF {formatSignedCurrency(r40Details.latest_fcf)})
                </span>
              </p>
            </div>
          )}
        </div>

        {/* EV / Revenue */}
        <div className="bg-surface border border-line rounded-xl p-5 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-ink inline-flex items-center gap-1.5">
                <span>
                  EV / Revenue ({derived.computation_ev_to_revenue_details?.latest_year || 'TTM'})
                </span>
                <InfoTooltip term="evToRevenue" />
              </h3>
              <p className="text-xs text-ink-muted mt-0.5">Enterprise Value to Annual Sales</p>
            </div>
            <span className="text-2xl font-bold font-mono text-ink num">
              {derived.ev_to_revenue !== undefined ? `${derived.ev_to_revenue.toFixed(2)}x` : '—'}
            </span>
          </div>

          {derived.computation_ev_to_revenue_details && (
            <div className="p-3 rounded-lg bg-subtle/70 border border-line text-xs space-y-1">
              <p className="text-ink-secondary">
                {derived.computation_ev_to_revenue_details.explanation}
              </p>
              <p className="font-mono text-ink num">
                EV: ${formatLargeNumber(derived.computation_ev_to_revenue_details.enterprise_value)}{' '}
                ÷ Rev: ${formatLargeNumber(derived.computation_ev_to_revenue_details.latest_revenue)}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
