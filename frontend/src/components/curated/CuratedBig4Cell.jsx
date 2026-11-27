import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatSignedCurrency, formatPercent } from '../../utils/formatters';
import { getGrowthTier } from '../../utils/valuationHelpers';

const BIG4_ROWS = [
  { key: 'revenue', short: 'Rev', defaultBasis: 'TTM', label: 'Revenue' },
  { key: 'net_income', short: 'NI', defaultBasis: 'TTM', label: 'Net Income' },
  { key: 'operating_cash_flow', short: 'OCF', defaultBasis: 'TTM', label: 'Operating Cash Flow' },
  { key: 'book_value', short: 'Book', defaultBasis: 'MRQ', label: 'Book Value' },
];

function MiniTrendSparkline({ history = [], trend = 'unavailable' }) {
  if (!Array.isArray(history) || history.length < 2) {
    return (
      <span
        className="inline-block w-8 h-3.5 text-center text-[10px] text-ink-muted leading-3"
        aria-hidden="true"
      >
        —
      </span>
    );
  }

  const values = history.slice(-6).map((pt) => Number(pt.value) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 32;
  const height = 13;
  const pad = 1.5;

  const points = values
    .map((val, idx) => {
      const x = pad + (idx / (values.length - 1)) * (width - pad * 2);
      const y = height - pad - ((val - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  let stroke = '#64748b';
  if (trend === 'strong_growth' || trend === 'growing' || trend === 'turnaround') {
    stroke = '#10b981';
  } else if (trend === 'contracting' || trend === 'negative') {
    stroke = '#f43f5e';
  } else if (values[values.length - 1] > values[0]) {
    stroke = '#10b981';
  } else if (values[values.length - 1] < values[0]) {
    stroke = '#f43f5e';
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block flex-shrink-0 overflow-visible"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function resolveDelta(item) {
  if (!item) return { pct: null, amount: null, basis: null, priorVal: null };

  // Prefer backend-computed TTM/MRQ delta fields
  if (item.delta_pct !== null && item.delta_pct !== undefined && Number.isFinite(Number(item.delta_pct))) {
    return {
      pct: Number(item.delta_pct),
      amount:
        item.delta_amount !== null && item.delta_amount !== undefined && Number.isFinite(Number(item.delta_amount))
          ? Number(item.delta_amount)
          : null,
      basis: item.delta_basis || (item.prior_fy_year ? `vs FY${String(item.prior_fy_year).slice(-2)}` : 'YoY'),
      priorVal:
        item.prior_fy_value !== null && item.prior_fy_value !== undefined && Number.isFinite(Number(item.prior_fy_value))
          ? Number(item.prior_fy_value)
          : null,
    };
  }

  // Graceful fallback for older cached docs
  const latest = Number(item.latest);
  const hist = Array.isArray(item.history)
    ? item.history.filter((pt) => pt && Number.isFinite(Number(pt.value)) && Number(pt.value) !== 0)
    : [];
  if (Number.isFinite(latest) && hist.length > 0) {
    const last = hist[hist.length - 1];
    const lastVal = Number(last.value);
    const sameAsFy = Math.abs(latest - lastVal) / Math.max(Math.abs(lastVal), 1) < 0.005;
    const base = sameAsFy && hist.length >= 2 ? hist[hist.length - 2] : !sameAsFy ? last : null;
    if (base && Number(base.value) !== 0) {
      const baseVal = Number(base.value);
      const amt = latest - baseVal;
      return {
        pct: amt / Math.abs(baseVal),
        amount: amt,
        basis: base.year ? `vs FY${String(base.year).slice(-2)}` : 'vs FY',
        priorVal: baseVal,
      };
    }
  }

  if (item.cagr_1y !== null && item.cagr_1y !== undefined && Number.isFinite(Number(item.cagr_1y))) {
    return { pct: Number(item.cagr_1y), amount: null, basis: '1Y', priorVal: null };
  }

  return { pct: null, amount: null, basis: null, priorVal: null };
}

function formatSignedDeltaPct(ratio) {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return '—';
  const pct = ratio * 100;
  if (Math.abs(pct) < 0.05) return '0.0%';
  const sign = pct > 0 ? '+' : '−';
  const absStr = Math.abs(pct) >= 100 ? Math.abs(pct).toFixed(0) : Math.abs(pct).toFixed(1);
  return `${sign}${absStr}%`;
}

function formatSignedDeltaAmount(amount, currency = 'USD') {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '—';
  if (amount === 0) return formatSignedCurrency(0, currency);
  const formatted = formatSignedCurrency(Math.abs(amount), currency);
  return amount > 0 ? `+${formatted}` : `−${formatted}`;
}

function getDeltaColorClass(ratio) {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return 'text-ink-muted';
  if (ratio >= 0.05) return 'text-emerald-700 dark:text-emerald-400';
  if (ratio > 0) return 'text-emerald-600 dark:text-emerald-400';
  if (ratio <= -0.05) return 'text-rose-600 dark:text-rose-400';
  if (ratio < 0) return 'text-amber-700 dark:text-amber-400';
  return 'text-ink-muted';
}

function pickPrimaryCagr(metricObj) {
  if (!metricObj) return { rate: null, horizon: '' };
  if (metricObj.cagr_3y !== null && metricObj.cagr_3y !== undefined) {
    return { rate: metricObj.cagr_3y, horizon: '3Y' };
  }
  if (metricObj.cagr_5y !== null && metricObj.cagr_5y !== undefined) {
    return { rate: metricObj.cagr_5y, horizon: '5Y' };
  }
  if (metricObj.cagr_1y !== null && metricObj.cagr_1y !== undefined) {
    return { rate: metricObj.cagr_1y, horizon: '1Y' };
  }
  return { rate: null, horizon: '' };
}

export default function CuratedBig4Cell({ big4 = {}, currency = 'USD', ticker = '' }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="w-full space-y-1 text-left"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Compact Sub-header */}
      <div className="grid grid-cols-[54px_1fr_76px_74px] items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-ink-muted/80 pb-0.5 border-b border-line/60">
        <span>Metric</span>
        <span className="text-right">TTM / MRQ</span>
        <span className="text-right">Δ Change</span>
        <span className="text-right">Trend</span>
      </div>

      {/* Big 4 TTM/MRQ + Delta Rows */}
      <div className="space-y-1">
        {BIG4_ROWS.map((row) => {
          const item = big4?.[row.key] || {};
          const basisTag = item.period_type || row.defaultBasis;
          const shortBasis = String(basisTag).startsWith('FY') ? 'FY' : basisTag;
          const delta = resolveDelta(item);
          const { rate, horizon } = pickPrimaryCagr(item);
          const tier = getGrowthTier(rate);

          const deltaTitle = [
            `${row.label} (${basisTag}): ${formatSignedCurrency(item.latest, currency)}`,
            delta.priorVal !== null
              ? `${delta.basis || 'Prior'}: ${formatSignedCurrency(delta.priorVal, currency)}`
              : null,
            delta.amount !== null
              ? `Δ ${formatSignedDeltaAmount(delta.amount, currency)} (${formatSignedDeltaPct(delta.pct)})`
              : delta.pct !== null
                ? `Δ ${formatSignedDeltaPct(delta.pct)} (${delta.basis || 'YoY'})`
                : null,
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <div
              key={row.key}
              title={deltaTitle}
              className="grid grid-cols-[54px_1fr_76px_74px] items-center gap-1.5 text-[11px] leading-tight"
            >
              {/* Metric + TTM/MRQ chip */}
              <div className="flex items-center gap-1 min-w-0">
                <span className="font-semibold text-ink-secondary">{row.short}</span>
                <span className="text-[8px] font-mono font-semibold uppercase px-1 py-px rounded bg-subtle text-ink-muted border border-line/70">
                  {shortBasis}
                </span>
              </div>

              {/* TTM / MRQ Value */}
              <span
                className={`font-mono font-bold num text-right whitespace-nowrap ${
                  item.latest !== null && item.latest < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-ink'
                }`}
              >
                {formatSignedCurrency(item.latest, currency)}
              </span>

              {/* TTM Delta % + compact basis/dollar */}
              <div className="text-right whitespace-nowrap leading-none">
                <span
                  className={`font-mono font-bold num text-[11px] block ${getDeltaColorClass(
                    delta.pct
                  )}`}
                >
                  {formatSignedDeltaPct(delta.pct)}
                </span>
                {delta.amount !== null ? (
                  <span className="text-[9px] font-mono text-ink-muted num block mt-0.5">
                    {formatSignedDeltaAmount(delta.amount, currency)}
                  </span>
                ) : delta.basis ? (
                  <span className="text-[9px] text-ink-muted block mt-0.5">{delta.basis}</span>
                ) : null}
              </div>

              {/* Sparkline + Primary CAGR */}
              <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                <MiniTrendSparkline history={item.history} trend={item.trend} />
                {rate !== null ? (
                  <span
                    className={`font-mono font-semibold num text-[10px] ${tier.textClass}`}
                    title={`${row.label} ${horizon} CAGR: ${formatPercent(rate, 1)}`}
                  >
                    {rate > 0 ? '+' : ''}
                    {formatPercent(rate, 0)}
                  </span>
                ) : (
                  <span className="font-mono text-[10px] text-ink-muted">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Expandable 1Y / 3Y / 5Y CAGR & Prior FY Delta Breakdown */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Hide' : 'Show'} multi-year Big 4 CAGRs and prior FY delta for ${ticker}`}
        className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand hover:underline cursor-pointer pt-0.5"
      >
        {expanded ? (
          <>
            <ChevronUp className="w-3 h-3" aria-hidden="true" />
            <span>Hide 1Y / 3Y / 5Y &amp; Δ details</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3 h-3" aria-hidden="true" />
            <span>1Y / 3Y / 5Y &amp; Δ details</span>
          </>
        )}
      </button>

      {expanded && (
        <div className="mt-1 p-2 rounded-lg bg-subtle/80 border border-line text-[10px] space-y-1">
          <div className="grid grid-cols-[36px_1fr_36px_36px_36px] gap-1 font-semibold text-ink-muted border-b border-line pb-1">
            <span>Metric</span>
            <span className="text-right">Prior FY</span>
            <span className="text-right">1Y</span>
            <span className="text-right">3Y</span>
            <span className="text-right">5Y</span>
          </div>
          {BIG4_ROWS.map((row) => {
            const item = big4?.[row.key] || {};
            const delta = resolveDelta(item);
            return (
              <div
                key={row.key}
                className="grid grid-cols-[36px_1fr_36px_36px_36px] gap-1 font-mono num items-center"
              >
                <span className="font-sans font-medium text-ink-secondary">{row.short}</span>
                <span className="text-right text-ink-muted whitespace-nowrap">
                  {delta.priorVal !== null
                    ? `${formatSignedCurrency(delta.priorVal, currency)} ${delta.basis ? `(${delta.basis.replace('vs ', '')})` : ''}`
                    : '—'}
                </span>
                {[item.cagr_1y, item.cagr_3y, item.cagr_5y].map((val, idx) => {
                  const t = getGrowthTier(val);
                  return (
                    <span
                      key={idx}
                      className={`text-right font-semibold ${
                        val !== null && val !== undefined ? t.textClass : 'text-ink-muted'
                      }`}
                    >
                      {val !== null && val !== undefined ? formatPercent(val, 0) : '—'}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
