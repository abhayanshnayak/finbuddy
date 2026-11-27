import { useId, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import InfoTooltip from '../ui/InfoTooltip';
import CuratedBig4Cell from './CuratedBig4Cell';
import { formatSignedCurrency, formatMetricPercent } from '../../utils/formatters';

const TEXT_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

function getReturnColorClass(pct) {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return 'text-ink-muted';
  if (pct >= 15) return 'text-emerald-700 dark:text-emerald-400';
  if (pct >= 10) return 'text-ink';
  if (pct >= 0) return 'text-amber-700 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function getMarginColorClass(pct) {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return 'text-ink-muted';
  if (pct >= 20) return 'text-emerald-700 dark:text-emerald-400';
  if (pct >= 10) return 'text-ink';
  if (pct >= 0) return 'text-amber-700 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function SortIcon() {
  return (
    <span className="inline-flex items-center flex-shrink-0" aria-hidden="true">
      <ArrowUpDown className="w-3 h-3 opacity-45 sc-sort-indicator-neutral" />
      <ArrowUp className="w-3 h-3 text-brand sc-sort-indicator-asc" />
      <ArrowDown className="w-3 h-3 text-brand sc-sort-indicator-desc" />
    </span>
  );
}

const COLUMNS = [
  { key: 'ticker', label: 'Company', type: 'text', align: 'left', tooltip: null },
  { key: 'revenue', label: 'Big 4 & Trends', type: 'number', align: 'left', tooltip: 'big4' },
  { key: 'roic_pct', label: 'ROIC', type: 'number', align: 'right', tooltip: 'returns' },
  { key: 'roe_pct', label: 'ROE', type: 'number', align: 'right', tooltip: null },
  { key: 'net_income_margin_pct', label: 'NI Margin', type: 'number', align: 'right', tooltip: 'netIncomeMargin' },
  { key: 'fcf_margin_pct', label: 'FCF Margin', type: 'number', align: 'right', tooltip: 'fcfMargin' },
  { key: 'total_debt', label: 'Debt', type: 'number', align: 'right', tooltip: 'debtAndCash' },
  { key: 'cash_and_equivalents', label: 'Cash & Equiv.', type: 'number', align: 'right', tooltip: null },
];

function extractSortValue(company, field) {
  if (field === 'ticker') return company.ticker || '';
  if (field === 'revenue') {
    const rev = company.big4?.revenue?.latest;
    return typeof rev === 'number' && Number.isFinite(rev) ? rev : null;
  }
  const raw = company[field];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

export default function CuratedStockTable({
  companies = [],
  caption = 'Curated companies financial comparison',
  showBucketTag = false,
}) {
  const navigate = useNavigate();
  const captionId = useId();
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('ascending');
  const [announcement, setAnnouncement] = useState('');

  const sortedCompanies = useMemo(() => {
    if (!sortField) return companies;
    const factor = sortDir === 'ascending' ? 1 : -1;

    return [...companies].sort((a, b) => {
      if (sortField === 'ticker') {
        return factor * TEXT_COLLATOR.compare(a.ticker || '', b.ticker || '');
      }
      const valA = extractSortValue(a, sortField);
      const valB = extractSortValue(b, sortField);
      if (valA === null && valB === null) {
        return TEXT_COLLATOR.compare(a.ticker || '', b.ticker || '');
      }
      if (valA === null) return 1;
      if (valB === null) return -1;
      return factor * (valA - valB);
    });
  }, [companies, sortField, sortDir]);

  const handleSort = (col) => {
    const nextDir =
      sortField === col.key
        ? sortDir === 'ascending'
          ? 'descending'
          : 'ascending'
        : col.type === 'number'
          ? 'descending'
          : 'ascending';
    setSortField(col.key);
    setSortDir(nextDir);
    setAnnouncement(`Sorted by ${col.label}, ${nextDir}, ${companies.length} rows.`);
  };

  if (companies.length === 0) {
    return (
      <div className="py-10 px-4 text-center text-xs text-ink-muted">
        No companies match your active filter in this group.
      </div>
    );
  }

  return (
    <div className="relative">
      <div role="status" aria-live="polite" className="visually-hidden">
        {announcement}
      </div>

      <div
        tabIndex={0}
        role="region"
        aria-labelledby={captionId}
        className="sc-curated-table-wrapper custom-scrollbar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded-b-xl"
      >
        <table className="sc-curated-table text-sm text-left">
          <caption id={captionId} className="visually-hidden">
            {caption}
          </caption>

          <thead className="bg-subtle/90 backdrop-blur-sm text-[11px] font-semibold text-ink-muted uppercase tracking-wider border-b border-line">
            <tr>
              {COLUMNS.map((col) => {
                const isSorted = sortField === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={isSorted ? sortDir : undefined}
                    className={`border-b border-line whitespace-nowrap ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    <div
                      className={`inline-flex items-center gap-1 w-full ${
                        col.align === 'right' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSort(col)}
                        className={`inline-flex items-center gap-1.5 min-h-[38px] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider hover:text-ink transition-colors cursor-pointer ${
                          col.align === 'right' ? 'justify-end' : 'justify-start'
                        } ${isSorted ? 'text-brand' : 'text-ink-muted'}`}
                      >
                        <span>{col.label}</span>
                        <SortIcon />
                      </button>
                      {col.tooltip && (
                        <span className="pr-2 -ml-1.5">
                          <InfoTooltip term={col.tooltip} />
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}

              <th
                scope="col"
                className="px-3 py-2.5 text-right border-b border-line whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-ink-muted"
              >
                Report
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-line">
            {sortedCompanies.map((company) => {
              const reportUrl = `/ticker/${encodeURIComponent(company.ticker)}`;
              const isEstablished = company.stage === 'established';
              const currency = company.reporting_currency || 'USD';
              const hasDebt = typeof company.total_debt === 'number' && Number.isFinite(company.total_debt);
              const hasCash =
                typeof company.cash_and_equivalents === 'number' &&
                Number.isFinite(company.cash_and_equivalents);
              const isNetCash = hasDebt && hasCash && company.cash_and_equivalents > company.total_debt;

              return (
                <tr
                  key={`${company.bucket_id}-${company.ticker}`}
                  onClick={(e) => {
                    if (e.target.closest('a, button, input, summary')) return;
                    navigate(reportUrl);
                  }}
                  className="hover:bg-subtle/60 transition-colors cursor-pointer group align-top"
                >
                  {/* 1. Sticky Row Header: Ticker, Name, Stage, Overview */}
                  <th
                    scope="row"
                    className="px-3.5 py-3.5 border-b border-line min-w-[270px] max-w-[330px]"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          to={reportUrl}
                          className="inline-flex items-center gap-1.5 group/link focus-visible:outline-none rounded-md"
                        >
                          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-subtle border border-line text-ink group-hover:border-brand group-hover:text-brand group-focus-visible/link:ring-2 group-focus-visible/link:ring-brand transition-colors">
                            {company.ticker}
                          </span>
                          <span className="font-semibold text-sm text-ink group-hover:text-brand transition-colors leading-snug">
                            {company.name}
                          </span>
                        </Link>

                        {currency !== 'USD' && (
                          <span
                            className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-subtle border border-line text-ink-muted"
                            title={`Financial figures reported in ${currency}`}
                          >
                            {currency}
                          </span>
                        )}
                      </div>

                      {/* Maturity Badge + Supply Chain Role + Cached Report indicator */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          title={company.stage_rationale}
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                            isEstablished
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                              : 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/25'
                          }`}
                        >
                          {isEstablished ? (
                            <ShieldCheck className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                          ) : (
                            <Sparkles className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                          )}
                          <span>{isEstablished ? 'Established' : 'Future Potential'}</span>
                        </span>

                        {showBucketTag && company.bucket_name && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-subtle text-ink-muted border border-line truncate max-w-[180px]">
                            {company.bucket_name}
                          </span>
                        )}

                        {company.has_full_report && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400"
                            title="Full 4-M equity research report already cached for instant loading"
                          >
                            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                            <span>Instant report</span>
                          </span>
                        )}
                      </div>

                      {/* Concise Company Overview */}
                      <p className="text-xs text-ink-secondary leading-relaxed">
                        {company.overview}
                      </p>

                      {/* Thesis Callout */}
                      {company.stage_rationale && (
                        <p className="text-[11px] text-ink-muted leading-snug italic">
                          {company.stage_rationale}
                        </p>
                      )}
                    </div>
                  </th>

                  {/* 2. Big 4 Numbers & Multi-Year Trends */}
                  <td className="px-3 py-3.5 border-b border-line">
                    <CuratedBig4Cell
                      big4={company.big4}
                      currency={currency}
                      ticker={company.ticker}
                    />
                  </td>

                  {/* 3. ROIC */}
                  <td className="px-3 py-3.5 border-b border-line text-right whitespace-nowrap">
                    <div className="flex flex-col items-end">
                      <span
                        className={`font-mono font-bold text-sm num ${getReturnColorClass(
                          company.roic_pct
                        )}`}
                      >
                        {formatMetricPercent(company.roic_pct, 1)}
                      </span>
                      {company.roic_5y_avg_pct !== null &&
                        company.roic_5y_avg_pct !== undefined && (
                          <span className="text-[11px] font-mono text-ink-muted num mt-0.5">
                            5Y: {formatMetricPercent(company.roic_5y_avg_pct, 1)}
                          </span>
                        )}
                    </div>
                  </td>

                  {/* 4. ROE */}
                  <td className="px-3 py-3.5 border-b border-line text-right whitespace-nowrap">
                    <div className="flex flex-col items-end">
                      <span
                        className={`font-mono font-bold text-sm num ${getReturnColorClass(
                          company.roe_pct
                        )}`}
                      >
                        {formatMetricPercent(company.roe_pct, 1)}
                      </span>
                      {company.roe_5y_avg_pct !== null &&
                        company.roe_5y_avg_pct !== undefined && (
                          <span className="text-[11px] font-mono text-ink-muted num mt-0.5">
                            5Y: {formatMetricPercent(company.roe_5y_avg_pct, 1)}
                          </span>
                        )}
                    </div>
                  </td>

                  {/* 5. Net Income Margin */}
                  <td className="px-3 py-3.5 border-b border-line text-right whitespace-nowrap">
                    <span
                      className={`font-mono font-bold text-sm num ${getMarginColorClass(
                        company.net_income_margin_pct
                      )}`}
                    >
                      {formatMetricPercent(company.net_income_margin_pct, 1)}
                    </span>
                  </td>

                  {/* 6. FCF Margin */}
                  <td className="px-3 py-3.5 border-b border-line text-right whitespace-nowrap">
                    <span
                      className={`font-mono font-bold text-sm num ${getMarginColorClass(
                        company.fcf_margin_pct
                      )}`}
                    >
                      {formatMetricPercent(company.fcf_margin_pct, 1)}
                    </span>
                  </td>

                  {/* 7. Total Debt */}
                  <td className="px-3 py-3.5 border-b border-line text-right whitespace-nowrap">
                    <div className="flex flex-col items-end">
                      <span className="font-mono font-semibold text-sm text-ink num">
                        {formatSignedCurrency(company.total_debt, currency)}
                      </span>
                      {hasDebt && hasCash && company.total_debt > company.cash_and_equivalents && (
                        <span className="text-[10px] font-mono text-ink-muted num mt-0.5">
                          Net {formatSignedCurrency(company.total_debt - company.cash_and_equivalents, currency)}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 8. Cash & Equivalents */}
                  <td className="px-3 py-3.5 border-b border-line text-right whitespace-nowrap">
                    <div className="flex flex-col items-end">
                      <span className="font-mono font-semibold text-sm text-ink num">
                        {formatSignedCurrency(company.cash_and_equivalents, currency)}
                      </span>
                      {isNetCash && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 mt-0.5">
                          Net Cash
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 9. Open Full Report Action */}
                  <td
                    className="px-3 py-3.5 border-b border-line text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link
                      to={reportUrl}
                      aria-label={`Open full research report for ${company.ticker}`}
                      className="inline-flex items-center gap-1 min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-semibold bg-brand-soft hover:bg-brand text-brand hover:text-white border border-brand/20 transition-colors"
                    >
                      <span>Report</span>
                      <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
