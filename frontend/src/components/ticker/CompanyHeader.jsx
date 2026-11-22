import { useState } from 'react';
import {
  RefreshCw,
  Printer,
  Copy,
  Check,
  Calculator,
  Clock,
  CheckCircle2,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import {
  formatLargeNumber,
  formatPrice,
  generateReportMarkdown,
} from '../../utils/formatters';

export default function CompanyHeader({
  report,
  growthAnalysis,
  isFreshFetch,
  isRefreshing,
  onForceRefresh,
  onOpenAudit,
}) {
  const [copied, setCopied] = useState(false);

  const taxonomy = [
    report.sector,
    report.subsector,
    report.industry_group,
  ].filter((item) => item && item !== 'Unknown');

  const marketCap = report.financials?.valuations?.market_cap;

  const handleCopyMarkdown = async () => {
    try {
      const md = generateReportMarkdown(report, growthAnalysis);
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API unavailable
    }
  };

  return (
    <header className="bg-surface border border-line rounded-xl p-5 sm:p-6 space-y-4 print-break-avoid">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        {/* Left: Identity & Taxonomy */}
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-sm font-bold px-2.5 py-1 rounded-md bg-brand text-white tracking-wide">
              {report.ticker}
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
              {report.name}
            </h1>
          </div>

          {/* NAICS Taxonomy Breadcrumb */}
          <div className="flex flex-wrap items-center gap-1 text-xs text-ink-muted">
            {report.industry && report.industry !== 'Unknown' && (
              <span className="font-medium text-ink-secondary">{report.industry}</span>
            )}
            {taxonomy.map((part, idx) => (
              <span key={idx} className="inline-flex items-center gap-1">
                {(idx > 0 || (report.industry && report.industry !== 'Unknown')) && (
                  <ChevronRight className="w-3 h-3 text-ink-muted/70" aria-hidden="true" />
                )}
                <span>{part}</span>
              </span>
            ))}
          </div>

          {/* Tags */}
          {report.tags && report.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {report.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 text-xs font-medium rounded-md bg-subtle text-ink-secondary border border-line"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right: Price Snapshot & Actions */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 flex-shrink-0">
          {/* Price & Market Cap */}
          <div className="flex items-baseline gap-4">
            <div className="text-left lg:text-right">
              <span className="text-xs font-medium text-ink-muted block">Price at Analysis</span>
              <span className="text-2xl font-bold font-mono text-ink num">
                {formatPrice(report.price_at_storage)}
              </span>
            </div>
            {marketCap > 0 && (
              <div className="pl-4 border-l border-line text-left lg:text-right">
                <span className="text-xs font-medium text-ink-muted block">Market Cap</span>
                <span className="text-lg font-semibold font-mono text-ink-secondary num">
                  ${formatLargeNumber(marketCap)}
                </span>
              </div>
            )}
          </div>

          {/* Provenance + Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 no-print">
            {/* Accurate Provenance Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
                isFreshFetch
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-subtle text-ink-secondary border-line'
              }`}
            >
              {isFreshFetch ? (
                <>
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Fresh Fetch</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand" aria-hidden="true" />
                  <span>Cached</span>
                </>
              )}
              {report.last_updated_pst && (
                <span className="inline-flex items-center gap-1 text-ink-muted pl-1 border-l border-line-strong">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  <span>{report.last_updated_pst} PST</span>
                </span>
              )}
            </span>

            <button
              type="button"
              onClick={onForceRefresh}
              disabled={isRefreshing}
              title="Bypass Firestore cache and re-run Finnhub, SEC XBRL & AI synthesis (~15–30s)"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface hover:bg-subtle text-ink border border-line-strong transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh Fresh'}</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenAudit('growth')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-soft hover:bg-brand/15 text-brand border border-brand/20 transition-colors cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Audit Math</span>
            </button>

            <button
              type="button"
              onClick={handleCopyMarkdown}
              title="Copy structured Markdown summary to clipboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface hover:bg-subtle text-ink-secondary hover:text-ink border border-line transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Markdown</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              title="Print or save report as PDF"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface hover:bg-subtle text-ink-secondary hover:text-ink border border-line transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
