import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { formatSignedCurrency, formatPercent } from '../../utils/formatters';
import { getGrowthTier } from '../../utils/valuationHelpers';

const BIG4_ROWS = [
  { key: 'revenue', short: 'Rev', label: 'Revenue' },
  { key: 'net_income', short: 'NI', label: 'Net Income' },
  { key: 'operating_cash_flow', short: 'OCF', label: 'Operating Cash Flow' },
  { key: 'book_value', short: 'Book', label: 'Book Value' },
];

function MiniTrendSparkline({ history = [], trend = 'unavailable' }) {
  if (!Array.isArray(history) || history.length < 2) {
    return (
      <span
        className="inline-block w-10 h-3.5 text-center text-[10px] text-ink-muted leading-3"
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
  const width = 40;
  const height = 14;
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

function getTrendBadgeInfo(trend) {
  switch (trend) {
    case 'strong_growth':
      return {
        label: 'Strong',
        Icon: TrendingUp,
        cls: 'text-emerald-700 dark:text-emerald-400',
      };
    case 'growing':
      return {
        label: 'Up',
        Icon: TrendingUp,
        cls: 'text-emerald-600 dark:text-emerald-400',
      };
    case 'turnaround':
      return {
        label: 'Inflecting',
        Icon: TrendingUp,
        cls: 'text-sky-700 dark:text-sky-400',
      };
    case 'contracting':
    case 'negative':
      return {
        label: trend === 'negative' ? 'Loss' : 'Down',
        Icon: TrendingDown,
        cls: 'text-rose-600 dark:text-rose-400',
      };
    case 'stable':
      return {
        label: 'Flat',
        Icon: Minus,
        cls: 'text-amber-600 dark:text-amber-400',
      };
    default:
      return null;
  }
}

export default function CuratedBig4Cell({ big4 = {}, currency = 'USD', ticker = '' }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="min-w-[270px] space-y-1.5 text-left"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-1 gap-1">
        {BIG4_ROWS.map((row) => {
          const item = big4?.[row.key] || {};
          const { rate, horizon } = pickPrimaryCagr(item);
          const tier = getGrowthTier(rate);
          const trendInfo = getTrendBadgeInfo(item.trend);

          return (
            <div
              key={row.key}
              className="flex items-center justify-between gap-2 text-[11px] leading-tight"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-ink-muted w-8 flex-shrink-0">
                  {row.short}
                </span>
                <span
                  className={`font-mono font-semibold num whitespace-nowrap ${
                    item.latest !== null && item.latest < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-ink'
                  }`}
                >
                  {formatSignedCurrency(item.latest, currency)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <MiniTrendSparkline history={item.history} trend={item.trend} />
                {rate !== null ? (
                  <span
                    className={`font-mono font-bold num text-[11px] w-[58px] text-right ${tier.textClass}`}
                    title={`${row.label} ${horizon} CAGR: ${formatPercent(rate, 1)}`}
                  >
                    {rate > 0 ? '+' : ''}
                    {formatPercent(rate, 0)}
                    <span className="text-[9px] font-medium opacity-75 ml-0.5">
                      {horizon}
                    </span>
                  </span>
                ) : trendInfo ? (
                  <span
                    className={`inline-flex items-center justify-end gap-0.5 text-[10px] font-semibold w-[58px] ${trendInfo.cls}`}
                  >
                    <trendInfo.Icon className="w-2.5 h-2.5 flex-shrink-0" aria-hidden="true" />
                    <span>{trendInfo.label}</span>
                  </span>
                ) : (
                  <span className="font-mono text-ink-muted w-[58px] text-right">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Expandable 1Y / 3Y / 5Y CAGR Breakdown */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Hide' : 'Show'} multi-year Big 4 CAGRs for ${ticker}`}
        className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand hover:underline cursor-pointer pt-0.5"
      >
        {expanded ? (
          <>
            <ChevronUp className="w-3 h-3" aria-hidden="true" />
            <span>Hide 1Y / 3Y / 5Y CAGRs</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3 h-3" aria-hidden="true" />
            <span>1Y / 3Y / 5Y CAGRs</span>
          </>
        )}
      </button>

      {expanded && (
        <div className="mt-1 p-2 rounded-lg bg-subtle/80 border border-line text-[10px] space-y-1">
          <div className="grid grid-cols-4 gap-1 font-semibold text-ink-muted border-b border-line pb-1">
            <span>Metric</span>
            <span className="text-right">1Y</span>
            <span className="text-right">3Y</span>
            <span className="text-right">5Y</span>
          </div>
          {BIG4_ROWS.map((row) => {
            const item = big4?.[row.key] || {};
            const c1 = item.cagr_1y;
            const c3 = item.cagr_3y;
            const c5 = item.cagr_5y;
            return (
              <div key={row.key} className="grid grid-cols-4 gap-1 font-mono num">
                <span className="font-sans font-medium text-ink-secondary">{row.short}</span>
                {[c1, c3, c5].map((val, idx) => {
                  const t = getGrowthTier(val);
                  return (
                    <span
                      key={idx}
                      className={`text-right font-semibold ${
                        val !== null && val !== undefined ? t.textClass : 'text-ink-muted'
                      }`}
                    >
                      {val !== null && val !== undefined ? formatPercent(val, 1) : '—'}
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
