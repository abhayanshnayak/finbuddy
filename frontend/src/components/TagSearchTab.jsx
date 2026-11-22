import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Filter,
  Search,
  X,
  ArrowUpDown,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  AlertCircle,
  Loader2,
  Database,
} from 'lucide-react';
import { useCompanies } from '../context/companiesStore';

export default function TagSearchTab() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { companies, loading, error, refreshCompanies } = useCompanies();

  // Persist tag filters & search query in URL query params so browser Back restores state
  const selectedTags = useMemo(() => {
    const raw = searchParams.get('tags') || '';
    return new Set(
      raw
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    );
  }, [searchParams]);

  const matchType = searchParams.get('match') === 'any' ? 'any' : 'all';
  const tickerSearchQuery = searchParams.get('q') || '';

  const [tagFilterQuery, setTagFilterQuery] = useState('');
  const [sortField, setSortField] = useState('ticker'); // 'ticker' | 'name' | 'industry' | 'last_updated_pst'
  const [sortDir, setSortDir] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  useEffect(() => {
    document.title = 'Tag & Company Screener — StockClue';
  }, []);

  const updateParams = (updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (!v) next.delete(k);
      else next.set(k, v);
    });
    setSearchParams(next, { replace: true });
    setCurrentPage(1);
  };

  const toggleTag = (tag) => {
    const nextSet = new Set(selectedTags);
    if (nextSet.has(tag)) nextSet.delete(tag);
    else nextSet.add(tag);
    updateParams({ tags: Array.from(nextSet).sort().join(',') });
  };

  const clearFilters = () => {
    setSearchParams({}, { replace: true });
    setCurrentPage(1);
  };

  // Compute all unique tags with company counts
  const tagCounts = useMemo(() => {
    const map = new Map();
    companies.forEach((company) => {
      (company.tags || []).forEach((t) => {
        const clean = String(t).trim().toLowerCase();
        if (clean) map.set(clean, (map.get(clean) || 0) + 1);
      });
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [companies]);

  const filteredAvailableTags = useMemo(() => {
    const q = tagFilterQuery.trim().toLowerCase();
    if (!q) return tagCounts;
    return tagCounts.filter(([tag]) => tag.includes(q));
  }, [tagCounts, tagFilterQuery]);

  // Filter & sort companies
  const filteredCompanies = useMemo(() => {
    const q = tickerSearchQuery.trim().toLowerCase();
    const selectedArr = Array.from(selectedTags);

    const list = companies.filter((company) => {
      if (selectedArr.length > 0) {
        const companyTags = (company.tags || []).map((t) => String(t).toLowerCase());
        const matchesTags =
          matchType === 'all'
            ? selectedArr.every((t) => companyTags.includes(t))
            : selectedArr.some((t) => companyTags.includes(t));
        if (!matchesTags) return false;
      }

      if (q) {
        const ticker = (company.ticker || '').toLowerCase();
        const name = (company.name || '').toLowerCase();
        const industry = (company.industry || '').toLowerCase();
        if (!ticker.includes(q) && !name.includes(q) && !industry.includes(q)) {
          return false;
        }
      }
      return true;
    });

    return [...list].sort((a, b) => {
      const valA = String(a[sortField] || '').toLowerCase();
      const valB = String(b[sortField] || '').toLowerCase();
      const cmp = valA.localeCompare(valB);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [companies, selectedTags, matchType, tickerSearchQuery, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredCompanies.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedCompanies = useMemo(() => {
    const startIdx = (safePage - 1) * itemsPerPage;
    return filteredCompanies.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredCompanies, safePage, itemsPerPage]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Tag Filter Workspace */}
      <section className="bg-surface border border-line rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
          <div>
            <h1 className="text-xl font-bold text-ink flex items-center gap-2">
              <Filter className="w-5 h-5 text-brand" aria-hidden="true" />
              <span>Tag &amp; Company Screener</span>
            </h1>
            <p className="text-xs text-ink-muted mt-1">
              Screen indexed equities by ingestion tags, strategy flags, or industry taxonomy.
            </p>
          </div>

          <button
            type="button"
            onClick={refreshCompanies}
            disabled={loading}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface hover:bg-subtle text-ink-secondary hover:text-ink border border-line-strong transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Index</span>
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2.5 bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/25 rounded-lg px-4 py-3 text-xs font-semibold"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tag Selector Panel */}
        <div className="bg-subtle/50 border border-line rounded-xl p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Tag Filters ({tagCounts.length})
              </span>
              {(selectedTags.size > 0 || tickerSearchQuery) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Reset All</span>
                </button>
              )}
            </div>

            {/* AND / OR Match Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-ink-muted">Logic:</span>
              <div className="inline-flex bg-subtle p-0.5 rounded-lg border border-line">
                <button
                  type="button"
                  onClick={() => updateParams({ match: 'all' })}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    matchType === 'all'
                      ? 'bg-surface text-brand shadow-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  All (AND)
                </button>
                <button
                  type="button"
                  onClick={() => updateParams({ match: 'any' })}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    matchType === 'any'
                      ? 'bg-surface text-brand shadow-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  Any (OR)
                </button>
              </div>
            </div>
          </div>

          {/* Search tags input */}
          {tagCounts.length > 8 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-2.5" />
              <input
                type="text"
                value={tagFilterQuery}
                onChange={(e) => setTagFilterQuery(e.target.value)}
                placeholder="Filter tag list..."
                className="w-full pl-8 pr-8 py-1.5 bg-surface border border-line focus:border-brand rounded-lg text-xs text-ink placeholder:text-ink-muted outline-none"
              />
              {tagFilterQuery && (
                <button
                  type="button"
                  onClick={() => setTagFilterQuery('')}
                  aria-label="Clear tag filter"
                  className="absolute right-2.5 top-2 text-ink-muted hover:text-ink cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Tag Pills with Counts */}
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-ink-muted">
              <Loader2 className="w-4 h-4 animate-spin text-brand" />
              <span>Loading indexed taxonomy...</span>
            </div>
          ) : filteredAvailableTags.length === 0 ? (
            <p className="text-xs text-ink-muted py-2">
              {tagCounts.length === 0
                ? 'No tags have been assigned to indexed companies yet.'
                : 'No tags match your filter.'}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
              {filteredAvailableTags.map(([tag, count]) => {
                const isSelected = selectedTags.has(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-brand text-white border-brand'
                        : 'bg-surface text-ink-secondary hover:text-ink hover:border-line-strong border-line'
                    }`}
                  >
                    <span>#{tag}</span>
                    <span
                      className={`font-mono text-[11px] num ${
                        isSelected ? 'text-white/80' : 'text-ink-muted'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Screener Results Data Table */}
      <section className="bg-surface border border-line rounded-xl overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-line flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" />
            <input
              type="text"
              value={tickerSearchQuery}
              onChange={(e) => updateParams({ q: e.target.value })}
              placeholder="Filter results by ticker, company name, or industry..."
              className="w-full pl-9 pr-8 py-2 bg-canvas border border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/20 rounded-lg text-sm text-ink placeholder:text-ink-muted outline-none"
            />
            {tickerSearchQuery && (
              <button
                type="button"
                onClick={() => updateParams({ q: '' })}
                aria-label="Clear search"
                className="absolute right-2.5 top-2.5 text-ink-muted hover:text-ink cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
            <span className="font-semibold text-ink font-mono num">
              {filteredCompanies.length} {filteredCompanies.length === 1 ? 'equity' : 'equities'}
            </span>
            <div className="flex items-center gap-1.5">
              <span>Rows:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                aria-label="Rows per page"
                className="px-2 py-1 bg-canvas border border-line-strong rounded-md text-ink font-semibold outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3 animate-pulse">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="h-10 bg-subtle rounded-lg" />
              ))}
            </div>
          ) : paginatedCompanies.length === 0 ? (
            <div className="py-16 px-4 text-center space-y-2">
              <Database className="w-8 h-8 text-ink-muted mx-auto opacity-50" />
              <p className="text-sm font-semibold text-ink-secondary">
                {companies.length === 0
                  ? 'No companies currently indexed in Firestore.'
                  : 'No companies match your active filters.'}
              </p>
              {selectedTags.size > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-semibold text-brand hover:underline cursor-pointer"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-subtle/80 text-xs font-semibold text-ink-muted uppercase tracking-wider border-b border-line">
                <tr>
                  {[
                    { field: 'ticker', label: 'Ticker' },
                    { field: 'name', label: 'Company' },
                    { field: 'industry', label: 'Industry' },
                  ].map((col) => (
                    <th key={col.field} className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleSort(col.field)}
                        className="inline-flex items-center gap-1 hover:text-ink transition-colors cursor-pointer uppercase"
                      >
                        <span>{col.label}</span>
                        <ArrowUpDown
                          className={`w-3 h-3 ${
                            sortField === col.field ? 'text-brand' : 'opacity-40'
                          }`}
                        />
                      </button>
                    </th>
                  ))}
                  <th className="px-4 py-3">Tags</th>
                  <th className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('last_updated_pst')}
                      className="inline-flex items-center gap-1 hover:text-ink transition-colors cursor-pointer uppercase"
                    >
                      <span>Last Updated</span>
                      <ArrowUpDown
                        className={`w-3 h-3 ${
                          sortField === 'last_updated_pst' ? 'text-brand' : 'opacity-40'
                        }`}
                      />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {paginatedCompanies.map((company) => (
                  <tr
                    key={company.ticker}
                    onClick={() => navigate(`/ticker/${encodeURIComponent(company.ticker)}`)}
                    className="hover:bg-subtle/60 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-md bg-subtle border border-line text-ink group-hover:border-brand group-hover:text-brand transition-colors">
                        {company.ticker}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-ink group-hover:text-brand transition-colors">
                      {company.name}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-ink-secondary">
                      {company.industry || '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {company.tags?.length > 0 ? (
                          company.tags.map((tag) => {
                            const active = selectedTags.has(String(tag).toLowerCase());
                            return (
                              <span
                                key={tag}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTag(String(tag).toLowerCase());
                                }}
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded border transition-colors ${
                                  active
                                    ? 'bg-brand-soft text-brand border-brand/30'
                                    : 'bg-subtle text-ink-muted border-line hover:text-ink'
                                }`}
                              >
                                #{tag}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-xs text-ink-muted">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs text-ink-muted num whitespace-nowrap">
                      {company.last_updated_pst || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand">
                        <span>Open</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-line bg-subtle/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-ink-muted font-mono num">
              Showing {(safePage - 1) * itemsPerPage + 1}–
              {Math.min(filteredCompanies.length, safePage * itemsPerPage)} of{' '}
              {filteredCompanies.length}
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-surface border border-line text-ink-secondary hover:text-ink disabled:opacity-40 font-semibold cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <span className="px-3 py-1 font-mono font-semibold text-ink num">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-surface border border-line text-ink-secondary hover:text-ink disabled:opacity-40 font-semibold cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
