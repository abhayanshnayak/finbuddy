import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import InfoTooltip from '../ui/InfoTooltip';
import {
  formatPrice,
  formatPercent,
  computeValuationDelta,
} from '../../utils/formatters';
import { evaluateBiasItem } from '../../utils/valuationHelpers';

function getQuadrantTone(quadrant = '') {
  const q = quadrant.toLowerCase();
  if (q.includes('clear moat') && q.includes('growing')) {
    return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25';
  }
  if (q.includes('fixed-size') && (q.includes('little moat') || q.includes('weak'))) {
    return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25';
  }
  if (q.includes('clear moat')) {
    return 'bg-brand-soft text-brand border-brand/25';
  }
  return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25';
}

export default function ExecutiveVerdictStrip({ report }) {
  const valuations = report.financials?.valuations || {};
  const derived = report.financials?.derived_metrics || {};
  const currentPrice = Number(report.price_at_storage) || 0;

  const mosPrice = Number(valuations.margin_of_safety_price) || 0;
  const stickerPrice = mosPrice > 0 ? mosPrice * 2 : 0;
  const ownersPerShare = Number(valuations.owners_value_per_share) || 0;
  const capRate = Number(valuations.cap_rate) || 0;
  const paybackYears = Number(valuations.payback_time_years) || 0;
  const paybackPass = paybackYears > 0 && paybackYears <= 8;
  const ownersPass = Boolean(valuations.computation_owners_value_details?.is_undervalued);

  const mosDelta = computeValuationDelta(mosPrice, currentPrice);
  const stickerDelta = computeValuationDelta(stickerPrice, currentPrice);

  // Bias risk flag count (with corrected polarity)
  const biasItems = report.context?.market_and_bias?.bias_checklist || [];
  const biasFlags = biasItems.filter((item) => evaluateBiasItem(item).isFlag).length;

  const quadrant = report.qualitative?.competitors?.market_structure_verdict?.quadrant;
  const ruleOf40 = derived.rule_of_40;

  // Build horizontal price ladder markers when at least currentPrice and 1 valuation exist
  const ladderPoints = [
    { key: 'mos', label: 'MOS Buy', value: mosPrice, color: 'bg-emerald-500' },
    { key: 'owners', label: '10-Cap', value: ownersPerShare, color: 'bg-violet-500' },
    { key: 'sticker', label: 'Sticker', value: stickerPrice, color: 'bg-blue-500' },
    { key: 'current', label: 'Current Price', value: currentPrice, color: 'bg-ink' },
  ].filter((p) => p.value > 0);

  const maxLadderVal =
    ladderPoints.length > 0 ? Math.max(...ladderPoints.map((p) => p.value)) * 1.12 : 0;

  const getPctPos = (val) => {
    if (!maxLadderVal || val <= 0) return 0;
    return Math.min(98, Math.max(2, (val / maxLadderVal) * 100));
  };

  return (
    <section aria-label="Executive Valuation Verdict" className="space-y-4 print-break-avoid">
      {/* 4-M Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 1. MOS Valuation Signal */}
        <div className="cq-card bg-surface border border-line rounded-xl p-4 flex flex-col justify-between gap-3 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted inline-flex items-center gap-1">
              <span>MOS Buy Price</span>
              <InfoTooltip term="mos" />
            </span>
            {mosDelta && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${
                  mosDelta.isAtOrBelowTarget
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                }`}
              >
                {mosDelta.isAtOrBelowTarget ? (
                  <TrendingUp className="w-3 h-3" aria-hidden="true" />
                ) : (
                  <TrendingDown className="w-3 h-3" aria-hidden="true" />
                )}
                <span>{mosDelta.shortBadge}</span>
              </span>
            )}
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono text-ink num">
              {mosPrice > 0 ? formatPrice(mosPrice) : 'N/A'}
            </span>
            <span className="text-xs text-ink-muted font-mono num">
              Sticker {stickerPrice > 0 ? formatPrice(stickerPrice) : '—'}
            </span>
          </div>

          <p className="text-xs text-ink-secondary">
            {stickerDelta
              ? stickerDelta.isAtOrBelowTarget
                ? `Trading below Fair Value (${stickerDelta.shortBadge})`
                : `Sticker Fair Value is ${Math.abs(stickerDelta.diffRatio * 100).toFixed(0)}% below market`
              : 'Requires positive TTM EPS for MOS model'}
          </p>
        </div>

        {/* 2. Payback Time Signal */}
        <div
          className={`cq-card bg-surface border border-line rounded-xl p-4 flex flex-col justify-between gap-3 border-l-4 ${
            paybackPass ? 'border-l-emerald-500' : 'border-l-amber-500'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted inline-flex items-center gap-1">
              <span>Payback Time</span>
              <InfoTooltip term="payback" />
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${
                paybackPass
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
              }`}
            >
              {paybackPass ? (
                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
              ) : (
                <AlertTriangle className="w-3 h-3" aria-hidden="true" />
              )}
              <span>{paybackPass ? 'Pass (≤8Y)' : 'Fail (>8Y)'}</span>
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono text-ink num">
              {paybackYears > 0 ? `${paybackYears} yrs` : '10+ yrs'}
            </span>
            <span className="text-xs text-ink-muted font-mono num">
              GR {formatPercent(valuations.windage_growth_rate_used, 1)}
            </span>
          </div>

          <p className="text-xs text-ink-secondary">
            {paybackYears > 0
              ? `Cumulative FCF recovers Market Cap in Year ${paybackYears}`
              : '10Y projected FCF does not recover current Market Cap'}
          </p>
        </div>

        {/* 3. Owner's Value (10-Cap) */}
        <div
          className={`cq-card bg-surface border border-line rounded-xl p-4 flex flex-col justify-between gap-3 border-l-4 ${
            ownersPass ? 'border-l-emerald-500' : 'border-l-violet-500'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted inline-flex items-center gap-1">
              <span>10-Cap Owner&apos;s Value</span>
              <InfoTooltip term="ownersValue" />
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${
                ownersPass
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'bg-subtle text-ink-secondary border border-line'
              }`}
            >
              <span>{ownersPass ? 'Pass (≥10%)' : `${formatPercent(capRate, 1)} Yield`}</span>
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono text-ink num">
              {ownersPerShare > 0 ? formatPrice(ownersPerShare) : 'N/A'}
            </span>
            <span className="text-xs text-ink-muted font-mono num">
              Target ≥10%
            </span>
          </div>

          <p className="text-xs text-ink-secondary">
            Zero-growth cash yield vs. Market Cap (Buffett 10-Cap)
          </p>
        </div>

        {/* 4. Business Quality & Risk Flags */}
        <div className="cq-card bg-surface border border-line rounded-xl p-4 flex flex-col justify-between gap-3 border-l-4 border-l-brand">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Quality &amp; Bias Check
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${
                biasFlags === 0
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : biasFlags <= 2
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
              }`}
            >
              <ShieldAlert className="w-3 h-3" aria-hidden="true" />
              <span>
                {biasFlags}/{biasItems.length} {biasFlags === 1 ? 'Flag' : 'Flags'}
              </span>
            </span>
          </div>

          <div className="space-y-1.5">
            {quadrant ? (
              <span
                className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-md border leading-snug ${getQuadrantTone(
                  quadrant
                )}`}
              >
                {quadrant}
              </span>
            ) : (
              <span className="text-sm font-semibold text-ink">4-M Assessment Ready</span>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-ink-secondary pt-0.5">
            <span>
              Rule of 40:{' '}
              <strong
                className={`font-mono num ${
                  ruleOf40 >= 40
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-ink'
                }`}
              >
                {ruleOf40 !== undefined ? ruleOf40.toFixed(1) : '—'}
              </strong>
            </span>
            <span>
              EV/Rev:{' '}
              <strong className="font-mono num text-ink">
                {derived.ev_to_revenue !== undefined
                  ? `${derived.ev_to_revenue.toFixed(1)}x`
                  : '—'}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Horizontal Valuation Price Ladder */}
      {ladderPoints.length >= 2 && (
        <div className="bg-surface border border-line rounded-xl px-5 py-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Intrinsic Value vs. Market Price Ladder
            </span>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              {ladderPoints.map((pt) => (
                <span key={pt.key} className="inline-flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${pt.color}`} />
                  <span className="text-ink-muted">{pt.label}:</span>
                  <strong className="font-mono text-ink num">{formatPrice(pt.value)}</strong>
                </span>
              ))}
            </div>
          </div>

          {/* Proportional Bar */}
          <div className="relative h-8 flex items-center">
            {/* Base Track */}
            <div className="w-full h-2 rounded-full bg-subtle border border-line relative overflow-hidden">
              {/* Highlighted MOS Buy Zone (0 -> MOS Price) */}
              {mosPrice > 0 && (
                <div
                  style={{ width: `${getPctPos(mosPrice)}%` }}
                  className="h-full bg-emerald-500/25 border-r-2 border-emerald-500"
                />
              )}
              {/* Fair Value Band (MOS -> Sticker) */}
              {mosPrice > 0 && stickerPrice > mosPrice && (
                <div
                  style={{
                    left: `${getPctPos(mosPrice)}%`,
                    width: `${getPctPos(stickerPrice) - getPctPos(mosPrice)}%`,
                  }}
                  className="absolute top-0 h-full bg-blue-500/15 border-r-2 border-blue-500"
                />
              )}
            </div>

            {/* Plot pins */}
            {ladderPoints.map((pt) => {
              const isCurrent = pt.key === 'current';
              return (
                <div
                  key={pt.key}
                  style={{ left: `${getPctPos(pt.value)}%` }}
                  title={`${pt.label}: ${formatPrice(pt.value)}`}
                  className="absolute -translate-x-1/2 flex flex-col items-center"
                >
                  <div
                    className={`${
                      isCurrent
                        ? 'w-3.5 h-6 rounded-sm bg-ink ring-2 ring-surface shadow-md'
                        : `w-3 h-3 rounded-full ${pt.color} ring-2 ring-surface`
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
