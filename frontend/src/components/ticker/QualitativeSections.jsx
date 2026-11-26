import { useState, useMemo } from 'react';
import {
  Flame,
  TrendingUp,
  Target,
  Hourglass,
  ExternalLink,
  Users,
  Shield,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Briefcase,
  Globe,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts';
import InfoTooltip from '../ui/InfoTooltip';
import { formatLargeNumber, formatPercent } from '../../utils/formatters';
import { evaluateBiasItem } from '../../utils/valuationHelpers';

function getVerdictBadgeClass(verdict = '') {
  const v = verdict.toLowerCase();
  if (v === 'pass') {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25';
  }
  if (v === 'warning') {
    return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25';
  }
  return 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25';
}

function getMoatStrengthClass(strength = '') {
  const s = strength.toLowerCase();
  if (s.includes('wide') || s.includes('very strong') || s.includes('dominant')) {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25';
  }
  if (s.includes('strong') || s.includes('narrow')) {
    return 'bg-brand-soft text-brand border-brand/25';
  }
  return 'bg-subtle text-ink-secondary border-line';
}

function normalizeReturnSeries(roicHistory = [], roeHistory = []) {
  const byPeriod = new Map();

  const extractYear = (item) => {
    if (item?.period) return String(item.period).slice(0, 4);
    if (item?.year) return String(item.year);
    return null;
  };
  const extractVal = (item) => {
    const raw = item?.v ?? item?.value;
    if (raw === null || raw === undefined || Number.isNaN(Number(raw))) return null;
    const n = Number(raw);
    // Finnhub series can be decimal (0.34) or percent; normalize to percentage
    return Math.abs(n) <= 3 ? Number((n * 100).toFixed(1)) : Number(n.toFixed(1));
  };

  roicHistory.slice(-10).forEach((item) => {
    const yr = extractYear(item);
    const val = extractVal(item);
    if (yr && val !== null) {
      byPeriod.set(yr, { ...(byPeriod.get(yr) || { year: yr }), roic: val });
    }
  });

  roeHistory.slice(-10).forEach((item) => {
    const yr = extractYear(item);
    const val = extractVal(item);
    if (yr && val !== null) {
      byPeriod.set(yr, { ...(byPeriod.get(yr) || { year: yr }), roe: val });
    }
  });

  return Array.from(byPeriod.values()).sort((a, b) => a.year.localeCompare(b.year));
}

export function OverviewAndSentiment({ report }) {
  const gurus = report.context?.market_and_bias?.gurus_buying || [];
  const sourceLinks = report.qualitative?.sources?.source_links || [];

  if (!report.overview && gurus.length === 0 && sourceLinks.length === 0) return null;

  return (
    <section
      id="section-overview"
      className="bg-surface border border-line rounded-xl p-5 sm:p-6 space-y-5 scroll-mt-32 print-break-avoid"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
        <h2 className="text-lg font-bold text-ink flex items-center gap-2">
          <Building2 className="w-4 h-4 text-brand" aria-hidden="true" />
          <span>Business Overview &amp; Market Context</span>
        </h2>
        {gurus.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1 text-ink-muted font-medium">
              <Users className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Notable Buyers:</span>
            </span>
            {gurus.map((g, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-md bg-brand-soft text-brand font-semibold border border-brand/20"
              >
                {g}
              </span>
            ))}
          </div>
        )}
      </div>

      {report.overview && (
        <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap max-w-[78ch]">
          {report.overview}
        </p>
      )}

      {sourceLinks.length > 0 && (
        <div className="pt-3 border-t border-line flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted mr-1">
            Primary Sources:
          </span>
          {sourceLinks.map((src, idx) => {
            const isUrl = typeof src === 'string' && /^https?:\/\//i.test(src);
            if (isUrl) {
              let host = src;
              try {
                host = new URL(src).hostname.replace(/^www\./, '');
              } catch {
                // keep raw string
              }
              return (
                <a
                  key={idx}
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-subtle hover:bg-brand-soft text-xs font-medium text-ink-secondary hover:text-brand border border-line transition-colors"
                >
                  <span className="truncate max-w-[220px]">{host}</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                </a>
              );
            }
            return (
              <span
                key={idx}
                className="px-2.5 py-1 rounded-md bg-subtle text-xs text-ink-secondary border border-line"
              >
                {String(src)}
              </span>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function StrategyAndRisks({ report }) {
  const growthPlans = report.qualitative?.growth_plans;
  const risks = report.qualitative?.risks?.key_risks || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print-break-avoid">
      {/* Growth & Strategy */}
      <section className="bg-surface border border-line rounded-xl p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-bold text-ink border-b border-line pb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-brand" aria-hidden="true" />
          <span>Growth &amp; Strategic Initiatives</span>
        </h2>
        {growthPlans?.strategy_summary && (
          <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">
            {growthPlans.strategy_summary}
          </p>
        )}
        {growthPlans?.key_initiatives?.length > 0 && (
          <ul className="space-y-2 pt-1">
            {growthPlans.key_initiatives.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-ink-secondary leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0 mt-2" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Challenges & Risks */}
      <section className="bg-surface border border-line rounded-xl p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-bold text-ink border-b border-line pb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500" aria-hidden="true" />
          <span>Key Risks &amp; Structural Challenges</span>
        </h2>
        <div className="divide-y divide-line">
          {risks.map((risk, i) => (
            <div key={i} className="py-3 first:pt-0 last:pb-0">
              <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                <span>{risk.risk}</span>
              </h3>
              <p className="text-sm text-ink-secondary mt-1 leading-relaxed">
                {risk.explanation}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function normalizeRatingOutOf5(val) {
  if (val === null || val === undefined || val === '' || typeof val === 'boolean') return null;
  const raw =
    typeof val === 'number'
      ? val
      : Number.parseFloat(String(val).replace(/[%,\s]/g, '').split('/')[0]);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  let scaled;
  if (raw <= 5) scaled = raw;
  else if (raw <= 10) scaled = (raw / 10) * 5;
  else if (raw <= 100) scaled = (raw / 100) * 5;
  else scaled = 5;
  return Number(Math.min(5, Math.max(0, scaled)).toFixed(1));
}

function formatHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function ManagementAndHealth({
  report,
  employeeSentiment = null,
  loadingSentiment = false,
  onRefreshSentiment = null,
}) {
  const mgmt = report.qualitative?.management || {};
  const raw = report.financials?.raw_data || {};
  const derived = report.financials?.derived_metrics || {};

  const ceoName = employeeSentiment?.ceo_name || mgmt.ceo_name || null;
  const ceoTenure =
    employeeSentiment?.ceo_tenure_years ?? mgmt.ceo_tenure_years ?? null;
  const ceoApprovalPct =
    employeeSentiment?.ceo_approval_pct ?? mgmt.ceo_approval_pct ?? null;
  const ceoRating = normalizeRatingOutOf5(
    employeeSentiment?.ceo_employee_rating ?? mgmt.ceo_employee_rating
  );
  const empSentiment = normalizeRatingOutOf5(
    employeeSentiment?.employee_happiness_score ?? mgmt.employee_happiness_score
  );
  const reviewCount = employeeSentiment?.review_count || mgmt.review_count || null;
  const sentimentSource =
    employeeSentiment?.source_platform || mgmt.sentiment_source || null;
  const sentimentNotes = employeeSentiment?.notes || mgmt.sentiment_notes || null;
  const sentimentSources = (
    Array.isArray(employeeSentiment?.grounding_sources)
      ? employeeSentiment.grounding_sources
      : Array.isArray(mgmt.sentiment_sources)
        ? mgmt.sentiment_sources
        : []
  ).filter((src) => typeof src?.url === 'string' && /^https?:\/\//i.test(src.url));
  const isGrounded = Boolean(employeeSentiment?.grounded ?? mgmt.sentiment_grounded);

  const debtPayoffYears = derived.debt_payoff_years;
  const debtDetails = derived.computation_debt_payoff_details || {};
  const debtIsTtm = debtDetails.basis === 'TTM';
  const debtFcfLabel = debtDetails.period_label || (debtIsTtm ? 'TTM' : 'FY');
  const debtFcfUsed = debtDetails.fcf_used;
  const hasDebtWithNegativeFcf =
    Number(raw.total_debt) > 0 &&
    debtFcfUsed !== undefined &&
    debtFcfUsed !== null &&
    Number(debtFcfUsed) <= 0;
  const debtHealthy =
    !hasDebtWithNegativeFcf && debtPayoffYears !== undefined && debtPayoffYears <= 3;

  const returnsSeries = useMemo(
    () => normalizeReturnSeries(raw.roic_history, raw.roe_history),
    [raw.roic_history, raw.roe_history]
  );

  const renderMetricCell = (val) => {
    if (!val && val !== 0) return <span className="text-ink-muted">—</span>;
    const isTarget = val >= 0.1;
    return (
      <span
        className={`font-mono font-semibold num ${
          isTarget ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink'
        }`}
      >
        {formatPercent(val, 1)}
      </span>
    );
  };

  return (
    <section
      id="section-management"
      className="bg-surface border border-line rounded-xl p-5 sm:p-6 space-y-6 scroll-mt-32 print-break-avoid"
    >
      <div className="border-b border-line pb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-ink flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-brand" aria-hidden="true" />
          <span>Management Quality &amp; Balance Sheet Health</span>
        </h2>
        <span className="text-xs text-ink-muted">
          Benchmarks: ROIC &amp; ROE ≥ 10% · Debt Payoff ≤ 3.0 yrs
        </span>
      </div>

      {/* Top Row: Leadership, Debt, Returns Table */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Leadership */}
        <div className="p-4 rounded-lg bg-subtle/60 border border-line space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Executive Leadership
            </h3>
            <div className="flex items-center gap-1.5">
              {loadingSentiment ? (
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-brand-soft text-brand animate-pulse">
                  Searching…
                </span>
              ) : isGrounded ? (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  title="Grounded via live Google Search"
                >
                  <Globe className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                  <span>
                    {sentimentSource && sentimentSource.toLowerCase() !== 'unavailable'
                      ? sentimentSource
                      : 'Search Grounded'}
                  </span>
                </span>
              ) : (ceoRating !== null || empSentiment !== null) ? (
                <span
                  className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-surface text-ink-muted border border-line"
                  title="Estimated from qualitative analysis; refresh to query live Google Search"
                >
                  AI Estimate
                </span>
              ) : null}

              {onRefreshSentiment && (
                <button
                  type="button"
                  onClick={onRefreshSentiment}
                  disabled={loadingSentiment}
                  title="Refresh CEO & employee sentiment via Google Search"
                  aria-label="Refresh CEO and employee sentiment via Google Search"
                  className="inline-flex items-center justify-center p-1 rounded bg-surface hover:bg-brand-soft text-ink-muted hover:text-brand border border-line transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed no-print"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${loadingSentiment ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2.5 text-sm">
            {ceoName && (
              <div className="flex justify-between items-center gap-2">
                <span className="text-ink-secondary">CEO</span>
                <span className="font-semibold text-ink text-right truncate" title={ceoName}>
                  {ceoName}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-ink-secondary">CEO Tenure</span>
              <span className="font-mono font-semibold text-ink num">
                {ceoTenure !== null && ceoTenure !== undefined ? `${ceoTenure} yrs` : '—'}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center gap-2">
                <span className="text-ink-secondary">CEO Rating</span>
                <span className="font-mono font-semibold text-ink num">
                  {ceoRating !== null ? `${ceoRating.toFixed(1)} / 5.0` : '—'}
                  {ceoApprovalPct !== null && (
                    <span className="ml-1.5 text-xs font-normal text-ink-muted">
                      ({ceoApprovalPct}% approval)
                    </span>
                  )}
                </span>
              </div>
              {ceoRating !== null && (
                <div
                  role="progressbar"
                  aria-label="CEO Rating"
                  aria-valuemin={0}
                  aria-valuemax={5}
                  aria-valuenow={ceoRating}
                  className="h-1.5 w-full rounded-full bg-line overflow-hidden"
                >
                  <div
                    style={{ width: `${Math.min(100, (ceoRating / 5) * 100)}%` }}
                    className="h-full bg-brand rounded-full"
                  />
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center gap-2">
                <span className="text-ink-secondary">Employee Sentiment</span>
                <span className="font-mono font-semibold text-ink num">
                  {empSentiment !== null ? `${empSentiment.toFixed(1)} / 5.0` : '—'}
                </span>
              </div>
              {empSentiment !== null && (
                <div
                  role="progressbar"
                  aria-label="Employee Sentiment"
                  aria-valuemin={0}
                  aria-valuemax={5}
                  aria-valuenow={empSentiment}
                  className="h-1.5 w-full rounded-full bg-line overflow-hidden"
                >
                  <div
                    style={{ width: `${Math.min(100, (empSentiment / 5) * 100)}%` }}
                    className="h-full bg-emerald-500 rounded-full"
                  />
                </div>
              )}
            </div>
          </div>

          {(sentimentNotes || reviewCount || sentimentSources.length > 0) && (
            <div className="pt-2.5 border-t border-line space-y-1.5">
              {(sentimentNotes || reviewCount) && (
                <p className="text-[11px] text-ink-muted leading-snug">
                  {sentimentNotes || `Based on ${reviewCount}`}
                </p>
              )}
              {sentimentSources.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {sentimentSources.slice(0, 3).map((src, idx) => (
                    <a
                      key={src.url || idx}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface hover:bg-brand-soft text-[11px] font-medium text-ink-secondary hover:text-brand border border-line transition-colors"
                      title={src.title || src.url}
                    >
                      <span className="truncate max-w-[120px]">
                        {src.title && src.title !== src.url
                          ? src.title
                          : formatHostname(src.url)}
                      </span>
                      <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Debt Status */}
        <div className="p-4 rounded-lg bg-subtle/60 border border-line space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Balance Sheet &amp; Debt
            </h3>
            {debtPayoffYears !== undefined && (
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  hasDebtWithNegativeFcf
                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                    : debtHealthy
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                }`}
              >
                {hasDebtWithNegativeFcf
                  ? 'Neg. FCF'
                  : debtHealthy
                    ? 'Healthy (≤3Y)'
                    : 'Elevated (>3Y)'}
              </span>
            )}
          </div>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-ink-secondary">Total Debt</span>
              <span className="font-mono font-semibold text-ink num">
                ${formatLargeNumber(raw.total_debt)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ink-secondary">Cash &amp; Equivalents</span>
              <span className="font-mono font-semibold text-ink num">
                ${formatLargeNumber(raw.cash_and_equivalents)}
              </span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-ink-secondary inline-flex items-center gap-1.5">
                <span>Years to Payoff</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                    debtIsTtm
                      ? 'bg-sky-500/10 border-sky-500/25 text-sky-700 dark:text-sky-300'
                      : 'bg-surface border-line text-ink-muted'
                  }`}
                >
                  {debtIsTtm ? 'TTM FCF' : `${debtFcfLabel} FCF`}
                </span>
              </span>
              <span
                className={`font-mono font-bold num ${
                  hasDebtWithNegativeFcf
                    ? 'text-rose-600 dark:text-rose-400'
                    : debtHealthy
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {hasDebtWithNegativeFcf
                  ? 'N/A'
                  : debtPayoffYears !== undefined
                    ? `${debtPayoffYears.toFixed(1)} yrs`
                    : '—'}
              </span>
            </div>
          </div>
          {debtFcfUsed !== undefined && debtFcfUsed !== null && (
            <div className="pt-2 border-t border-line flex items-center justify-between gap-2 text-[11px] text-ink-muted font-mono num">
              <span>{debtFcfLabel} FCF</span>
              <span
                className={
                  Number(debtFcfUsed) < 0 ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-ink-secondary'
                }
              >
                {Number(debtFcfUsed) < 0
                  ? `−$${formatLargeNumber(Math.abs(debtFcfUsed))}`
                  : `$${formatLargeNumber(debtFcfUsed)}`}
              </span>
            </div>
          )}
        </div>

        {/* Capital Efficiency Table */}
        <div className="p-4 rounded-lg bg-subtle/60 border border-line space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted inline-flex items-center gap-1">
            <span>Capital Returns</span>
            <InfoTooltip term="returns" />
          </h3>
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs text-ink-muted border-b border-line">
                <th className="pb-2 font-semibold">Metric</th>
                <th className="pb-2 text-right font-semibold">3Y</th>
                <th className="pb-2 text-right font-semibold">5Y</th>
                <th className="pb-2 text-right font-semibold">10Y</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr>
                <td className="py-2 font-medium text-ink-secondary">ROIC</td>
                <td className="py-2 text-right">{renderMetricCell(mgmt.roic_3_yr_avg)}</td>
                <td className="py-2 text-right">{renderMetricCell(mgmt.roic_5_yr_avg)}</td>
                <td className="py-2 text-right">{renderMetricCell(mgmt.roic_10_yr_avg)}</td>
              </tr>
              <tr>
                <td className="py-2 font-medium text-ink-secondary">ROE</td>
                <td className="py-2 text-right">{renderMetricCell(mgmt.roe_3_yr_avg)}</td>
                <td className="py-2 text-right">{renderMetricCell(mgmt.roe_5_yr_avg)}</td>
                <td className="py-2 text-right">{renderMetricCell(mgmt.roe_10_yr_avg)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Row: ROIC/ROE 10Y Trend Chart + Board of Directors */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {returnsSeries.length >= 2 && (
          <div className="lg:col-span-7 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              10-Year ROIC vs. ROE Trend (10% Target Line)
            </h3>
            <div className="h-48 w-full bg-subtle/40 border border-line rounded-lg p-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={returnsSeries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
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
                    formatter={(val, name) => [`${val}%`, name.toUpperCase()]}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <ReferenceLine y={10} stroke="#10b981" strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey="roic"
                    name="ROIC"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="roe"
                    name="ROE"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className={`${returnsSeries.length >= 2 ? 'lg:col-span-5' : 'lg:col-span-12'} space-y-2`}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
            Board of Directors &amp; Governance
          </h3>
          <div className="p-4 rounded-lg bg-subtle/60 border border-line text-sm text-ink-secondary leading-relaxed h-[calc(100%-1.5rem)]">
            {mgmt.board_of_directors_summary || 'No governance summary available.'}
          </div>
        </div>
      </div>
    </section>
  );
}

export function GrowthCompanyAnalysisSection({ growthAnalysis, loading }) {
  const pillars = [
    {
      key: 'cash_burn',
      title: 'Cash Burn Strategy',
      icon: Flame,
      data: growthAnalysis?.cash_burn,
      fallback: growthAnalysis?.cash_burn_analysis,
    },
    {
      key: 'gross_margin',
      title: 'Margin Trajectory',
      icon: TrendingUp,
      data: growthAnalysis?.gross_margin,
      fallback: growthAnalysis?.gross_margin_analysis,
    },
    {
      key: 'profitability_path',
      title: 'Path to Profitability',
      icon: Target,
      data: growthAnalysis?.profitability_path,
      fallback: growthAnalysis?.path_to_profitability,
    },
    {
      key: 'runway',
      title: 'Balance Sheet Runway',
      icon: Hourglass,
      data: growthAnalysis?.runway,
      fallback: growthAnalysis?.runway_analysis,
    },
  ];

  return (
    <section className="bg-surface border border-line rounded-xl p-5 sm:p-6 space-y-4 print-break-avoid">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <h2 className="text-lg font-bold text-ink">AI Growth &amp; Unit Economics Assessment</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Skeptical evaluation of cash burn efficiency, gross margin durability, profitability path, and runway
          </p>
        </div>

        {loading && (
          <span className="text-xs font-semibold text-brand bg-brand-soft px-2.5 py-1 rounded-md border border-brand/20 animate-pulse">
            Synthesizing AI assessment...
          </span>
        )}
        {growthAnalysis?.generated_at && !loading && (
          <span className="text-xs font-mono text-ink-muted">
            Generated {new Date(growthAnalysis.generated_at).toLocaleDateString()}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="p-4 rounded-lg bg-subtle border border-line space-y-2.5">
              <div className="h-4 w-1/3 bg-line rounded" />
              <div className="h-3 w-full bg-line rounded" />
              <div className="h-3 w-4/5 bg-line rounded" />
            </div>
          ))}
        </div>
      ) : growthAnalysis ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            const verdict = pillar.data?.verdict || 'N/A';
            return (
              <div
                key={pillar.key}
                className="p-4 rounded-lg bg-subtle/50 border border-line space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-surface border border-line flex items-center justify-center text-brand">
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <h3 className="text-sm font-bold text-ink">{pillar.title}</h3>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded-md border ${getVerdictBadgeClass(
                      verdict
                    )}`}
                  >
                    {verdict}
                  </span>
                </div>
                <p className="text-sm text-ink-secondary leading-relaxed">
                  {pillar.data?.justification || pillar.fallback || 'No details available.'}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-ink-muted italic py-2">No growth analysis available.</p>
      )}
    </section>
  );
}

export function MoatAnalysisSection({ report }) {
  const moats = report.qualitative?.moats?.moat_types || [];
  if (moats.length === 0) return null;

  return (
    <section
      id="section-moat"
      className="bg-surface border border-line rounded-xl p-5 sm:p-6 space-y-4 scroll-mt-32 print-break-avoid"
    >
      <h2 className="text-lg font-bold text-ink border-b border-line pb-3 flex items-center gap-2">
        <Shield className="w-4 h-4 text-brand" aria-hidden="true" />
        <span>Economic Moat Breakdown</span>
      </h2>
      <div className="divide-y divide-line">
        {moats.map((moat, i) => (
          <div key={i} className="py-3.5 first:pt-0 last:pb-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-ink">{moat.type}</h3>
              <span
                className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${getMoatStrengthClass(
                  moat.strength
                )}`}
              >
                {moat.strength} Moat
              </span>
            </div>
            <p className="text-sm text-ink-secondary leading-relaxed max-w-[82ch]">
              {moat.rationale}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BiasChecklistSection({ report }) {
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'flags'
  const checklist = report.context?.market_and_bias?.bias_checklist;

  const evaluated = useMemo(() => {
    const rawItems = checklist || [];
    return rawItems
      .map((item, idx) => ({ ...item, idx, eval: evaluateBiasItem(item) }))
      .sort((a, b) => Number(b.eval.isFlag) - Number(a.eval.isFlag));
  }, [checklist]);

  if (evaluated.length === 0) return null;

  const flagCount = evaluated.filter((e) => e.eval.isFlag).length;
  const clearCount = evaluated.length - flagCount;
  const visibleItems =
    filterMode === 'flags' ? evaluated.filter((e) => e.eval.isFlag) : evaluated;

  return (
    <section
      id="section-bias"
      className="bg-surface border border-line rounded-xl p-5 sm:p-6 space-y-4 scroll-mt-32 print-break-avoid"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Confirmation Bias &amp; Risk Checklist</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Structured adversarial due-diligence checks sorted with risk flags first
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${
              flagCount > 0
                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
            }`}
          >
            {flagCount > 0 ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            <span>
              {flagCount} {flagCount === 1 ? 'Risk Flag' : 'Risk Flags'} · {clearCount} Clear
            </span>
          </span>

          <div className="inline-flex rounded-lg bg-subtle p-0.5 border border-line no-print">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                filterMode === 'all' ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
              }`}
            >
              All ({evaluated.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('flags')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                filterMode === 'flags' ? 'bg-surface text-rose-600 dark:text-rose-400 shadow-sm' : 'text-ink-muted hover:text-ink'
              }`}
            >
              Flags ({flagCount})
            </button>
          </div>
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <div className="p-6 text-center rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Zero risk flags detected across all {evaluated.length} due-diligence checks.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {visibleItems.map((item) => {
            const { isFlag, answerText, statusLabel } = item.eval;
            return (
              <div
                key={item.idx}
                className={`p-4 rounded-lg border space-y-2 ${
                  isFlag
                    ? 'bg-rose-500/5 border-rose-500/25'
                    : 'bg-emerald-500/5 border-emerald-500/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-ink leading-snug">{item.question}</p>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                        isFlag
                          ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {answerText} · {statusLabel}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-ink-secondary leading-relaxed">{item.rationale}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
