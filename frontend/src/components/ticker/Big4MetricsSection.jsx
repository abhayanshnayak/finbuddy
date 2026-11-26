import { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import InfoTooltip from '../ui/InfoTooltip';
import { formatSignedCurrency, formatPercent } from '../../utils/formatters';
import { getGrowthTier } from '../../utils/valuationHelpers';

const METRIC_META = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'net_income', label: 'Net Income' },
  { key: 'operating_cash_flow', label: 'Operating Cash Flow' },
  { key: 'book_value', label: 'Book Value' },
];

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatPeriodShort(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '';
  const match = isoDate.match(/^(\d{4})-(\d{2})/);
  if (!match) return isoDate;
  const year = match[1];
  const monthIdx = Number(match[2]) - 1;
  if (monthIdx < 0 || monthIdx > 11) return year;
  return `${MONTHS_SHORT[monthIdx]} ${year}`;
}

function formatTtmSource(source) {
  if (source === 'xbrl_quarterly') return 'SEC 10-Q/10-K XBRL';
  if (source === 'xbrl_annual') return 'SEC 10-K XBRL';
  if (source === 'finnhub_metrics') return 'Finnhub TTM Metrics';
  return '';
}

function hasValidTtm(entry) {
  return Boolean(
    entry &&
    entry.value !== null &&
    entry.value !== undefined &&
    !Number.isNaN(Number(entry.value))
  );
}

function MiniSparkline({ data = [] }) {
  if (!data || data.length < 2) {
    return <span className="text-xs text-ink-muted">—</span>;
  }
  const values = data.slice(-10).map((d) => Number(d.value) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 76;
  const height = 24;
  const pad = 2;

  const points = values
    .map((val, idx) => {
      const x = pad + (idx / (values.length - 1)) * (width - pad * 2);
      const y = height - pad - ((val - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const isGrowing = values[values.length - 1] >= values[0];
  const strokeColor = isGrowing ? '#10b981' : '#f43f5e';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block overflow-visible"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function Big4MetricsSection({ report }) {
  const [selectedMetric, setSelectedMetric] = useState('revenue');
  const raw = report.financials?.raw_data || {};
  const ratesMap = report.financials?.derived_metrics?.growth_rates_1_3_5_10_yr || {};
  const big4Ttm = raw.big4_ttm || {};

  const historyMap = {
    revenue: raw.revenue_history || [],
    net_income: raw.net_income_history || [],
    book_value: raw.book_value_history || [],
    operating_cash_flow: raw.operating_cash_flow_history || [],
  };

  const annualSeries = (historyMap[selectedMetric] || []).slice(-10).map((pt) => ({
    year: String(pt.year),
    value: pt.value,
    isTtm: false,
  }));

  const activeTtm = big4Ttm[selectedMetric];
  const activeHasTtm = hasValidTtm(activeTtm);
  const activeTtmType = activeTtm?.period_type || (selectedMetric === 'book_value' ? 'MRQ' : 'TTM');
  const activeTtmPeriod = formatPeriodShort(activeTtm?.period);

  const activeSeries = activeHasTtm
    ? [
      ...annualSeries,
      {
        year: activeTtmType,
        value: Number(activeTtm.value),
        isTtm: true,
        period: activeTtm.period,
        periodType: activeTtmType,
      },
    ]
    : annualSeries;

  const periodsBack = [1, 3, 5, 10];

  return (
    <section
      id="section-financials"
      className="bg-surface border border-line rounded-xl p-5 sm:p-6 space-y-6 scroll-mt-32 print-break-avoid"
    >
      {/* Header + Target Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h2 className="text-lg font-bold text-ink inline-flex items-center gap-1.5">
            <span>Big 4 Core Growth &amp; 10-Year Trajectory</span>
            <InfoTooltip term="big4" />
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Trailing twelve-month (TTM / MRQ) run-rate values, annual fiscal-year CAGRs, and 10-year dollar progression
          </p>
        </div>

        {/* 3-Tier Color Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>≥ 10% Target</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>0–9.9% Moderate</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>&lt; 0% Contracting</span>
          </span>
        </div>
      </div>

      {/* Interactive 10-Year Historical + TTM/MRQ Bar Chart */}
      {activeSeries.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex flex-wrap gap-1 bg-subtle p-1 rounded-lg border border-line no-print">
              {METRIC_META.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setSelectedMetric(m.key)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${selectedMetric === m.key
                      ? 'bg-surface text-brand shadow-sm'
                      : 'text-ink-muted hover:text-ink'
                    }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
              {activeHasTtm && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/25 text-sky-700 dark:text-sky-300 font-mono font-semibold num">
                  <span className="w-2 h-2 rounded-sm bg-sky-500" />
                  <span>
                    {activeTtmType}
                    {activeTtmPeriod ? ` (${activeTtmPeriod})` : ''}:{' '}
                    {formatSignedCurrency(activeTtm.value)}
                  </span>
                </span>
              )}
              {annualSeries.length > 0 && (
                <span className="inline-flex items-center gap-1.5 font-mono">
                  <span className="w-2 h-2 rounded-sm bg-blue-600/85" />
                  <span>
                    Annual FY ({annualSeries[0]?.year}–{annualSeries[annualSeries.length - 1]?.year})
                  </span>
                </span>
              )}
            </div>
          </div>

          <div className="h-56 w-full bg-subtle/40 border border-line rounded-lg p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activeSeries} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
                  axisLine={{ stroke: 'var(--chart-grid)' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => formatSignedCurrency(v)}
                  tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'var(--accent-soft)' }}
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-strong)',
                    borderRadius: '0.5rem',
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                  }}
                  labelFormatter={(label, payload) => {
                    const pt = payload?.[0]?.payload;
                    if (pt?.isTtm) {
                      const periodTxt = formatPeriodShort(pt.period);
                      return periodTxt ? `${pt.periodType} (${periodTxt})` : pt.periodType;
                    }
                    return `FY ${label}`;
                  }}
                  formatter={(value) => [
                    formatSignedCurrency(value),
                    METRIC_META.find((m) => m.key === selectedMetric)?.label,
                  ]}
                />
                <ReferenceLine y={0} stroke="var(--border-strong)" />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {activeSeries.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        entry.value < 0
                          ? entry.isTtm
                            ? '#e11d48'
                            : '#f43f5e'
                          : entry.isTtm
                            ? '#0ea5e9'
                            : '#2563eb'
                      }
                      fillOpacity={entry.isTtm ? 0.95 : 0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Big 4 CAGR & TTM/MRQ Table */}
      <div className="overflow-x-auto border border-line rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="bg-subtle text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-line">
            <tr>
              <th scope="col" className="px-4 py-3">Metric</th>
              <th scope="col" className="px-3 py-3 text-center hidden sm:table-cell">10Y Trend</th>
              <th scope="col" className="px-4 py-3 text-right whitespace-nowrap">
                <span className="inline-flex items-center justify-end gap-1">
                  <span>TTM / MRQ</span>
                  <InfoTooltip term="big4Ttm" />
                </span>
              </th>
              <th scope="col" className="px-4 py-3 text-right">1Y CAGR</th>
              <th scope="col" className="px-4 py-3 text-right">3Y CAGR</th>
              <th scope="col" className="px-4 py-3 text-right">5Y CAGR</th>
              <th scope="col" className="px-4 py-3 text-right">10Y CAGR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {Object.entries(ratesMap).map(([key, rates]) => {
              const history = historyMap[key] || [];
              const latestAnnual = history.length > 0 ? history[history.length - 1] : null;
              const currentVal = latestAnnual ? latestAnnual.value : null;
              const ttmEntry = big4Ttm[key];
              const ttmAvailable = hasValidTtm(ttmEntry);
              const ttmType = ttmEntry?.period_type || (key === 'book_value' ? 'MRQ' : 'TTM');
              const ttmPeriodShort = formatPeriodShort(ttmEntry?.period);
              const ttmSourceLabel = formatTtmSource(ttmEntry?.source);
              const isActiveRow = selectedMetric === key;

              let ttmTitle = `${ttmType} value unavailable`;
              if (ttmAvailable) {
                const parts = [`${ttmType}: ${formatSignedCurrency(ttmEntry.value)}`];
                if (ttmEntry.period) parts.push(`As of ${ttmEntry.period}`);
                if (currentVal !== null && latestAnnual?.year) {
                  if (currentVal > 0) {
                    const deltaPct = ((Number(ttmEntry.value) - currentVal) / currentVal) * 100;
                    const sign = deltaPct >= 0 ? '+' : '';
                    parts.push(
                      `vs FY${latestAnnual.year} ${formatSignedCurrency(currentVal)} (${sign}${deltaPct.toFixed(1)}%)`
                    );
                  } else {
                    parts.push(`FY${latestAnnual.year}: ${formatSignedCurrency(currentVal)}`);
                  }
                }
                if (ttmSourceLabel) parts.push(`Source: ${ttmSourceLabel}`);
                ttmTitle = parts.join(' · ');
              }

              return (
                <tr
                  key={key}
                  onClick={() => setSelectedMetric(key)}
                  className={`transition-colors cursor-pointer ${isActiveRow ? 'bg-brand-soft/60' : 'hover:bg-subtle/60'
                    }`}
                >
                  <td className="px-4 py-3 font-semibold text-ink capitalize whitespace-nowrap">
                    {key.replace(/_/g, ' ')}
                  </td>
                  <td className="px-3 py-3 text-center hidden sm:table-cell">
                    <MiniSparkline data={history} />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap" title={ttmTitle}>
                    {ttmAvailable ? (
                      <>
                        <span
                          className={`font-mono font-bold num ${Number(ttmEntry.value) < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-ink'
                            }`}
                        >
                          {formatSignedCurrency(ttmEntry.value)}
                        </span>
                        <div className="text-[11px] text-ink-muted font-mono num mt-0.5 whitespace-nowrap">
                          {ttmType}
                          {ttmPeriodShort ? ` · ${ttmPeriodShort}` : ''}
                        </div>
                      </>
                    ) : (
                      <span className="font-mono text-ink-muted">—</span>
                    )}
                  </td>
                  {(rates || []).map((rate, i) => {
                    const yearsBack = periodsBack[i];
                    const startIdx = history.length - 1 - yearsBack;
                    const startVal = startIdx >= 0 ? history[startIdx].value : null;
                    const tier = getGrowthTier(rate);

                    return (
                      <td key={i} className="px-4 py-3 text-right">
                        <span
                          className={`font-mono font-bold num ${tier.textClass}`}
                          title={tier.label}
                        >
                          {formatPercent(rate, 1)}
                        </span>
                        {startVal !== null && currentVal !== null && (
                          <div className="text-[11px] text-ink-muted font-mono num mt-0.5 whitespace-nowrap">
                            {formatSignedCurrency(startVal)} → {formatSignedCurrency(currentVal)}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
