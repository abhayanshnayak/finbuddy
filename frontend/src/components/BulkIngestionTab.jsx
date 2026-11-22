import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  Upload,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Clock,
  AlertTriangle,
  Search,
  ChevronRight,
  Copy,
  Check,
  Trash2,
} from 'lucide-react';
import { useCompanies } from '../context/companiesStore';

const PRESET_MEGA_CAP = 'AAPL, MSFT, GOOGL, AMZN, NVDA, META';
const PRESET_COMPOUNDERS =
  'AAPL, MSFT, GOOGL, AMZN, NVDA, META, COST, WMT, PEP, KO, ADBE, ORCL';
const PRESET_ERROR_DEMO = 'AAPL, MSFT, INVALID123, GOOGL';

export default function BulkIngestionTab() {
  const navigate = useNavigate();
  const { refreshCompanies } = useCompanies();

  const [bulkInput, setBulkInput] = useState('');
  const [bulkTagsInput, setBulkTagsInput] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState(null);
  const [batchStatus, setBatchStatus] = useState(null);
  const [bulkForceFresh, setBulkForceFresh] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedErrors, setExpandedErrors] = useState({});
  const [copiedBatchId, setCopiedBatchId] = useState(false);

  useEffect(() => {
    document.title = 'Bulk Pipeline — StockClue';
  }, []);

  // Live parsed & deduplicated ticker analysis
  const parsedStats = useMemo(() => {
    const raw = bulkInput
      .split(/[\s,\n]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
    const unique = Array.from(new Set(raw));
    const duplicates = raw.length - unique.length;
    const estMinutes = Math.max(1, Math.ceil(unique.length / 20));
    return { rawCount: raw.length, unique, uniqueCount: unique.length, duplicates, estMinutes };
  }, [bulkInput]);

  const startBulkIngestion = async (e) => {
    e.preventDefault();
    setBulkError('');
    setBatchStatus(null);
    setActiveBatchId(null);
    setExpandedErrors({});

    const rawTickers = parsedStats.unique;
    const rawTags = Array.from(
      new Set(
        bulkTagsInput
          .split(/[\s,\n]+/)
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      )
    );

    if (rawTickers.length === 0) {
      setBulkError('Please enter at least one stock ticker symbol.');
      return;
    }

    if (rawTickers.length > 500) {
      setBulkError(`Maximum batch size is 500 unique tickers. You entered ${rawTickers.length}.`);
      return;
    }

    const tickerRegex = /^[A-Z0-9.-]+$/;
    const invalidTickers = rawTickers.filter((t) => !tickerRegex.test(t));
    if (invalidTickers.length > 0) {
      setBulkError(
        `Invalid characters or formats in tickers: ${invalidTickers.slice(0, 5).join(', ')}${
          invalidTickers.length > 5 ? '...' : ''
        }`
      );
      return;
    }

    setBulkLoading(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiBase}/api/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tickers: rawTickers,
          force_fresh: bulkForceFresh,
          tags: rawTags,
        }),
      });

      if (!response.ok) {
        let detail = 'Failed to submit bulk ingestion batch.';
        try {
          const errorData = await response.json();
          if (errorData?.detail) detail = errorData.detail;
        } catch {
          // keep fallback
        }
        throw new Error(detail);
      }

      const data = await response.json();
      setActiveBatchId(data.batch_id);
      setBatchStatus(data);
    } catch (err) {
      setBulkError(err.message || 'Unable to submit bulk batch.');
    } finally {
      setBulkLoading(false);
    }
  };

  // Poll active batch progress
  useEffect(() => {
    if (!activeBatchId) return undefined;

    let intervalId;
    const pollStatus = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const response = await fetch(`${apiBase}/api/batch/${activeBatchId}`);
        if (!response.ok) throw new Error('Failed to fetch batch status.');
        const data = await response.json();
        setBatchStatus(data);

        const completedCount = data.completed_count || 0;
        const failedCount = data.failed_count || 0;
        const total = data.total_symbols || 0;
        const isFinished =
          data.status === 'completed' || (total > 0 && completedCount + failedCount === total);

        if (isFinished) {
          clearInterval(intervalId);
          refreshCompanies();
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    pollStatus();
    intervalId = setInterval(pollStatus, 2000);
    return () => clearInterval(intervalId);
  }, [activeBatchId, refreshCompanies]);

  const toggleErrorDetail = (tickerSym) => {
    setExpandedErrors((prev) => ({ ...prev, [tickerSym]: !prev[tickerSym] }));
  };

  const handleCopyBatchId = async () => {
    if (!batchStatus?.batch_id) return;
    try {
      await navigator.clipboard.writeText(batchStatus.batch_id);
      setCopiedBatchId(true);
      setTimeout(() => setCopiedBatchId(false), 1800);
    } catch {
      // ignore
    }
  };

  const filterCounts = useMemo(() => {
    const counts = { all: 0, completed: 0, failed: 0, pending: 0, processing: 0 };
    if (!batchStatus?.symbols) return counts;
    Object.values(batchStatus.symbols).forEach((data) => {
      counts.all += 1;
      if (data.status === 'completed') counts.completed += 1;
      else if (data.status === 'failed') counts.failed += 1;
      else if (data.status === 'pending') counts.pending += 1;
      else if (data.status === 'processing') counts.processing += 1;
    });
    return counts;
  }, [batchStatus]);

  const filteredSymbols = useMemo(() => {
    if (!batchStatus?.symbols) return [];
    const searchTerms = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);

    return Object.entries(batchStatus.symbols).filter(([sym, data]) => {
      const tickerLower = sym.toLowerCase();
      const tagsString = (data.tags || []).join(' ').toLowerCase();

      const matchesSearch =
        searchTerms.length === 0 ||
        searchTerms.every((term) => tickerLower.includes(term) || tagsString.includes(term));

      const matchesStatus = statusFilter === 'all' || data.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [batchStatus, searchQuery, statusFilter]);

  const totalSymbols = batchStatus?.total_symbols || 0;
  const processedCount = (batchStatus?.completed_count || 0) + (batchStatus?.failed_count || 0);
  const percentComplete =
    totalSymbols > 0 ? Math.round((processedCount / totalSymbols) * 100) : 0;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Submission Card */}
      <section className="bg-surface border border-line rounded-xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-line pb-4">
          <div>
            <h1 className="text-xl font-bold text-ink flex items-center gap-2">
              <Layers className="w-5 h-5 text-brand" aria-hidden="true" />
              <span>Bulk Stock Ingestion Pipeline</span>
            </h1>
            <p className="text-xs text-ink-muted mt-1">
              Queue up to 500 unique symbols for automated Finnhub retrieval, valuation modeling, AI
              filings synthesis, and persistent Firestore caching.
            </p>
          </div>
          <span className="text-xs font-mono text-ink-muted bg-subtle border border-line px-2.5 py-1 rounded-md self-start">
            Rate limit: ~20 req/min
          </span>
        </div>

        <form onSubmit={startBulkIngestion} className="space-y-5">
          {/* Ticker Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="bulk-tickers" className="font-semibold text-ink">
                Ticker Symbols
              </label>
              {parsedStats.uniqueCount > 0 && (
                <span
                  className={`font-mono num ${
                    parsedStats.uniqueCount > 500
                      ? 'text-rose-600 dark:text-rose-400 font-bold'
                      : 'text-ink-muted'
                  }`}
                >
                  {parsedStats.uniqueCount} / 500 unique
                  {parsedStats.duplicates > 0 && ` (${parsedStats.duplicates} dup removed)`}
                  {' · '}Est. ~{parsedStats.estMinutes} min if uncached
                </span>
              )}
            </div>
            <textarea
              id="bulk-tickers"
              rows={4}
              value={bulkInput}
              onChange={(e) => {
                setBulkInput(e.target.value);
                if (bulkError) setBulkError('');
              }}
              placeholder="Enter symbols separated by commas, spaces, or newlines (e.g., AAPL, MSFT, NVDA, GOOGL)..."
              className="w-full px-4 py-3 bg-canvas border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 rounded-lg outline-none transition-all text-ink placeholder:text-ink-muted font-mono text-sm leading-relaxed"
            />
          </div>

          {/* Optional Tags Input */}
          <div className="space-y-1.5">
            <label htmlFor="bulk-tags" className="text-xs font-semibold text-ink block">
              Watchlist / Strategy Tags <span className="text-ink-muted font-normal">(optional)</span>
            </label>
            <input
              id="bulk-tags"
              type="text"
              value={bulkTagsInput}
              onChange={(e) => setBulkTagsInput(e.target.value)}
              placeholder="e.g. tech, wide-moat, q4-watchlist"
              className="w-full px-4 py-2.5 bg-canvas border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 rounded-lg outline-none transition-all text-ink placeholder:text-ink-muted font-mono text-sm"
            />
          </div>

          {/* Force Fresh Toggle */}
          <label
            htmlFor="bulkForceFresh"
            className="flex items-start gap-2.5 p-3 rounded-lg bg-subtle/60 border border-line cursor-pointer select-none"
          >
            <input
              type="checkbox"
              id="bulkForceFresh"
              checked={bulkForceFresh}
              onChange={(e) => setBulkForceFresh(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-blue-600 rounded cursor-pointer"
            />
            <div className="text-xs">
              <span className="font-semibold text-ink block">
                Force Fresh Data (Bypass Firestore Cache)
              </span>
              <span className="text-ink-muted">
                Re-fetches Finnhub statements, SEC XBRL filings, and Gemini analysis for every ticker in the batch.
              </span>
            </div>
          </label>

          {/* Presets & Submit Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setBulkInput(PRESET_MEGA_CAP);
                  setBulkTagsInput('mega-cap, tech');
                  setBulkError('');
                }}
                className="px-3 py-1.5 bg-subtle hover:bg-line text-ink-secondary hover:text-ink text-xs font-semibold rounded-lg border border-line transition-colors cursor-pointer"
              >
                Mega-Cap Tech (6)
              </button>
              <button
                type="button"
                onClick={() => {
                  setBulkInput(PRESET_COMPOUNDERS);
                  setBulkTagsInput('compounders');
                  setBulkError('');
                }}
                className="px-3 py-1.5 bg-subtle hover:bg-line text-ink-secondary hover:text-ink text-xs font-semibold rounded-lg border border-line transition-colors cursor-pointer"
              >
                Quality Compounders (12)
              </button>
              <button
                type="button"
                onClick={() => {
                  setBulkInput(PRESET_ERROR_DEMO);
                  setBulkError('');
                }}
                className="px-3 py-1.5 text-ink-muted hover:text-ink text-xs font-medium underline underline-offset-2 cursor-pointer"
              >
                Error Handling Demo
              </button>
              {bulkInput && (
                <button
                  type="button"
                  onClick={() => {
                    setBulkInput('');
                    setBulkTagsInput('');
                    setBulkError('');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-semibold rounded-lg border border-rose-500/20 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={bulkLoading || parsedStats.uniqueCount === 0}
              className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
            >
              {bulkLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" aria-hidden="true" />
                  <span>Start Ingestion Pipeline</span>
                </>
              )}
            </button>
          </div>

          {bulkError && (
            <div
              role="alert"
              className="flex items-center gap-2 bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/25 rounded-lg px-4 py-3 text-xs font-medium"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>{bulkError}</span>
            </div>
          )}
        </form>
      </section>

      {/* Pipeline Execution Monitor */}
      {batchStatus && (
        <section
          aria-live="polite"
          className="bg-surface border border-line rounded-xl p-6 space-y-6 animate-fadeIn"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-lg font-bold text-ink">Pipeline Execution Monitor</h2>
                <span
                  className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider border ${
                    batchStatus.status === 'completed'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                      : batchStatus.status === 'processing_locally'
                        ? 'bg-brand-soft text-brand border-brand/25'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25 animate-pulse'
                  }`}
                >
                  {batchStatus.status}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                <span>Batch ID:</span>
                <code className="bg-subtle text-ink-secondary px-2 py-0.5 rounded border border-line font-mono text-xs">
                  {batchStatus.batch_id}
                </code>
                <button
                  type="button"
                  onClick={handleCopyBatchId}
                  aria-label="Copy Batch ID"
                  className="p-1 rounded hover:bg-subtle text-ink-muted hover:text-ink transition-colors cursor-pointer"
                >
                  {copiedBatchId ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Completion
              </p>
              <p className="text-2xl font-bold font-mono text-brand num">{percentComplete}%</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-ink-muted font-mono num">
              <span>
                PROCESSED {processedCount} OF {totalSymbols} SYMBOLS
              </span>
              <span>{percentComplete}%</span>
            </div>
            <div className="w-full bg-subtle rounded-full h-3 overflow-hidden border border-line">
              <div
                style={{ width: `${percentComplete}%` }}
                className="bg-brand h-full rounded-full transition-all duration-500 ease-out"
              />
            </div>
          </div>

          {/* KPI Stat Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-lg bg-subtle/60 border border-line text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Total Queue
              </p>
              <p className="text-2xl font-bold font-mono text-ink mt-1 num">{totalSymbols}</p>
            </div>
            <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Ingested
              </p>
              <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 num">
                {batchStatus.completed_count || 0}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-rose-500/5 border border-rose-500/20 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                Failed
              </p>
              <p className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1 num">
                {batchStatus.failed_count || 0}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                In Flight / Queued
              </p>
              <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1 num">
                {filterCounts.pending + filterCounts.processing}
              </p>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="space-y-3">
            <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
              <h3 className="text-sm font-bold text-ink">Task Processing Breakdown</h3>

              <div className="flex overflow-x-auto gap-1 bg-subtle p-1 rounded-lg border border-line">
                {[
                  { id: 'all', label: `All (${filterCounts.all})` },
                  { id: 'completed', label: `Ingested (${filterCounts.completed})` },
                  { id: 'failed', label: `Failed (${filterCounts.failed})` },
                  { id: 'processing', label: `Processing (${filterCounts.processing})` },
                  { id: 'pending', label: `Queued (${filterCounts.pending})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      statusFilter === tab.id
                        ? 'bg-surface text-brand shadow-sm'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <Search
                className="w-4 h-4 text-ink-muted absolute left-3.5 top-3"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter tasks by ticker symbol or tag..."
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-canvas border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none text-sm text-ink placeholder:text-ink-muted"
              />
            </div>
          </div>

          {/* Task Rows */}
          <div className="border border-line rounded-xl overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto divide-y divide-line custom-scrollbar">
              {filteredSymbols.length === 0 ? (
                <div className="text-center py-10 text-ink-muted text-sm">
                  No ticker tasks match the active filter.
                </div>
              ) : (
                filteredSymbols.map(([sym, item]) => (
                  <div
                    key={sym}
                    className="p-4 bg-surface hover:bg-subtle/50 transition-colors space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono font-bold text-sm px-2.5 py-1 rounded-md bg-subtle border border-line text-ink">
                          {sym}
                        </span>
                        {item.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {item.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-xs px-2 py-0.5 rounded bg-subtle text-ink-muted border border-line"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.timestamp && (
                          <span className="text-xs font-mono text-ink-muted num">
                            {new Date(item.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Status Pill */}
                        {item.status === 'completed' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Ingested</span>
                          </span>
                        )}
                        {item.status === 'processing' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                            <span>Processing</span>
                          </span>
                        )}
                        {item.status === 'pending' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-subtle text-ink-muted border border-line">
                            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Queued</span>
                          </span>
                        )}
                        {item.status === 'failed' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/25">
                            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Failed</span>
                          </span>
                        )}

                        {/* Action Button (FIXED: previously called undefined viewSingleTicker) */}
                        {item.status === 'completed' && (
                          <button
                            type="button"
                            onClick={() => navigate(`/ticker/${encodeURIComponent(sym)}`)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-soft hover:bg-brand text-brand hover:text-white border border-brand/25 transition-colors cursor-pointer"
                          >
                            <span>View Report</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {item.status === 'failed' && (
                          <button
                            type="button"
                            onClick={() => toggleErrorDetail(sym)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/25 transition-colors cursor-pointer"
                          >
                            {expandedErrors[sym] ? 'Hide Error' : 'Show Error'}
                          </button>
                        )}
                      </div>
                    </div>

                    {item.status === 'failed' && expandedErrors[sym] && (
                      <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-3 text-xs font-mono space-y-1">
                        <p className="font-bold uppercase text-rose-700 dark:text-rose-400">
                          Failure Details
                        </p>
                        <p className="text-ink-secondary break-words">
                          {item.error || 'Unknown Pipeline Server Error'}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
