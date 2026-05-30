import React, { useState, useEffect } from 'react';
import SingleTickerTab from './SingleTickerTab';

export default function TagSearchTab() {
  const [companies, setCompanies] = useState([]);
  const [selectedTags, setSelectedTags] = useState(new Set());
  const [matchType, setMatchType] = useState('all'); // 'all' (AND) or 'any' (OR)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filtering inputs
  const [tagFilterQuery, setTagFilterQuery] = useState('');
  const [tickerSearchQuery, setTickerSearchQuery] = useState('');

  // Pagination states (user can dynamically pick page sizing: 5, 10, 20, 30)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Selected ticker for sub-view (renders detailed page while keeping search state active)
  const [activeTickerDetail, setActiveTickerDetail] = useState(null);

  useEffect(() => {
    const fetchCompanies = async () => {
      setLoading(true);
      setError('');
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const response = await fetch(`${apiBase}/api/companies`);
        if (!response.ok) {
          throw new Error('Failed to load companies from backend database.');
        }
        const data = await response.json();
        setCompanies(data || []);
      } catch (err) {
        console.error("Error fetching companies:", err);
        setError(err.message || 'Unable to connect to the backend server.');
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, []);

  // Reset page to 1 when filters, search query, or items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTags, matchType, tickerSearchQuery, itemsPerPage]);

  // Extract all unique tags across all companies (sorted alphabetically)
  const allUniqueTags = React.useMemo(() => {
    const tags = new Set();
    companies.forEach(company => {
      if (company.tags && Array.isArray(company.tags)) {
        company.tags.forEach(tag => {
          if (tag) tags.add(tag.trim().toLowerCase());
        });
      }
    });
    return Array.from(tags).sort();
  }, [companies]);

  // Handle toggling tag selections
  const toggleTag = (tag) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedTags(new Set());
  };

  // Filter available tags shown in the selector grid
  const filteredAvailableTags = allUniqueTags.filter(tag => 
    tag.includes(tagFilterQuery.toLowerCase().trim())
  );

  // Compute final matching companies
  const filteredCompanies = React.useMemo(() => {
    return companies.filter(company => {
      // 1. Tag matching logic
      let matchesTags = true;
      if (selectedTags.size > 0) {
        const companyTags = (company.tags || []).map(t => t.toLowerCase());
        const selectedArr = Array.from(selectedTags);
        
        if (matchType === 'all') {
          // AND logic: company must contain EVERY selected tag
          matchesTags = selectedArr.every(t => companyTags.includes(t));
        } else {
          // OR logic: company must contain AT LEAST ONE selected tag
          matchesTags = selectedArr.some(t => companyTags.includes(t));
        }
      }

      // 2. Text search query (matches ticker, name, or industry)
      let matchesSearch = true;
      if (tickerSearchQuery.trim()) {
        const query = tickerSearchQuery.toLowerCase().trim();
        const ticker = (company.ticker || '').toLowerCase();
        const name = (company.name || '').toLowerCase();
        const industry = (company.industry || '').toLowerCase();
        
        matchesSearch = ticker.includes(query) || name.includes(query) || industry.includes(query);
      }

      return matchesTags && matchesSearch;
    });
  }, [companies, selectedTags, matchType, tickerSearchQuery]);

  // Pagination computations
  const totalPages = Math.ceil(filteredCompanies.length / itemsPerPage);
  const paginatedCompanies = React.useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredCompanies.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredCompanies, currentPage, itemsPerPage]);

  // If a ticker is selected for detail view, render it inline
  // This preserves the search state perfectly when returning!
  if (activeTickerDetail) {
    return (
      <SingleTickerTab
        initialTicker={activeTickerDetail}
        onBack={() => setActiveTickerDetail(null)}
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Search Header/Title Block */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center space-x-2">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Tag-Based Database Query</span>
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Search, filter, and discover tickers based on ingestion categories, strategic flags, or sector tags.
          </p>
        </div>

        {error && (
          <div className="flex items-center space-x-2.5 bg-red-50 text-red-700 border border-red-100 rounded-xl px-4 py-3 text-sm font-semibold">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 10 2 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <svg className="animate-spin h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm font-semibold text-slate-500">Querying company database...</span>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Tag Filter Selection Workspace */}
            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-5">
              
              {/* Tag Controls & Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-150 pb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">Filter Workspace</span>
                  {selectedTags.size > 0 && (
                    <button
                      onClick={clearSelection}
                      className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-650 hover:text-red-750 text-[10px] font-bold rounded-lg border border-red-100 transition-colors flex items-center space-x-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Clear Tags ({selectedTags.size})</span>
                    </button>
                  )}
                </div>

                {/* Match Type (AND / OR) Radio-styled Selectors */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500 font-semibold mr-1">Match Type:</span>
                  <div className="bg-slate-150/70 p-1 rounded-xl flex space-x-1 border border-slate-205">
                    <button
                      onClick={() => setMatchType('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 flex items-center space-x-1 ${
                        matchType === 'all'
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      <span>All (AND)</span>
                    </button>
                    <button
                      onClick={() => setMatchType('any')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 flex items-center space-x-1 ${
                        matchType === 'any'
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      <span>Any (OR)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tag Search Input */}
              <div className="relative">
                <input
                  type="text"
                  value={tagFilterQuery}
                  onChange={(e) => setTagFilterQuery(e.target.value)}
                  placeholder="Filter available tags..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all rounded-xl text-xs shadow-inner"
                />
                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {tagFilterQuery && (
                  <button 
                    onClick={() => setTagFilterQuery('')} 
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 font-bold text-xs"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Unique Tags Grid */}
              {allUniqueTags.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-400 font-medium">
                  No tags have been assigned to database tickers yet.
                </div>
              ) : filteredAvailableTags.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-400 font-medium">
                  No tags match your filter query.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2.5 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
                  {filteredAvailableTags.map(tag => {
                    const isSelected = selectedTags.has(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-300 transform hover:scale-[1.02] cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white border-transparent shadow-sm shadow-blue-500/10'
                            : 'bg-white text-slate-650 hover:bg-slate-100/80 border-slate-200'
                        }`}
                      >
                        <span>{tag}</span>
                        {isSelected && (
                          <svg className="w-3.5 h-3.5 ml-0.5 text-blue-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* In-results Search and Filter bar */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-3 gap-3">
                <div className="flex items-center space-x-2">
                  <h4 className="text-base font-bold text-gray-800 flex items-center space-x-2">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span>Query Results ({filteredCompanies.length})</span>
                  </h4>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                  {selectedTags.size > 0 && (
                    <span className="text-xs font-semibold text-slate-500 uppercase bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                      Filtering {selectedTags.size} {selectedTags.size === 1 ? 'tag' : 'tags'} ({matchType.toUpperCase()})
                    </span>
                  )}
                  
                  {/* Items per page selector */}
                  <div className="flex items-center space-x-1.5 text-xs">
                    <span className="text-slate-400 font-semibold">Per Page:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => setItemsPerPage(Number(e.target.value))}
                      className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-bold outline-none cursor-pointer shadow-sm transition-colors"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={30}>30</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={tickerSearchQuery}
                  onChange={(e) => setTickerSearchQuery(e.target.value)}
                  placeholder="Filter results by ticker, company name, or industry..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-inner text-sm"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3.5 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Results Table Panel */}
            <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-inner bg-slate-50/50">
              <div className="divide-y divide-slate-100">
                {paginatedCompanies.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 space-y-3">
                    <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-center text-gray-400 text-sm font-medium">
                      {companies.length === 0 
                        ? 'No companies currently indexed in the database.' 
                        : 'No tickers match the selected tags and query filter.'}
                    </p>
                  </div>
                ) : (
                  paginatedCompanies.map(company => (
                    <div
                      key={company.ticker}
                      onClick={() => setActiveTickerDetail(company.ticker)}
                      className="hover:bg-slate-50 transition-colors p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer group"
                    >
                      <div className="flex items-center space-x-3.5">
                        
                        {/* Ticker Monospaced Badge */}
                        <span className="text-base font-extrabold text-slate-800 tracking-wide font-mono bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm group-hover:border-blue-400 group-hover:text-blue-600 transition-colors">
                          {company.ticker}
                        </span>

                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-slate-800 tracking-tight group-hover:text-blue-600 transition-colors">
                            {company.name}
                          </p>
                          <p className="text-xs text-gray-400 font-semibold uppercase">
                            {company.industry || 'Unknown Industry'}
                          </p>
                        </div>
                      </div>

                      {/* Tag badging layout */}
                      <div className="flex flex-wrap gap-1.5 max-w-[280px]">
                        {company.tags && company.tags.length > 0 ? (
                          company.tags.map(tag => {
                            const isFiltering = selectedTags.has(tag.toLowerCase());
                            return (
                              <span
                                key={tag}
                                className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border transition-colors ${
                                  isFiltering
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-white text-slate-400 border-slate-200'
                                }`}
                              >
                                {tag}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-white text-slate-300 px-2 py-0.5 rounded-lg border border-slate-100">
                            No Tags
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="self-end sm:self-auto">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTickerDetail(company.ticker);
                          }}
                          className="px-3.5 py-2 bg-blue-50 group-hover:bg-blue-600 text-blue-700 group-hover:text-white text-xs font-bold rounded-xl border border-blue-105 shadow-sm group-hover:shadow-md group-hover:shadow-blue-500/10 transition-all duration-350 flex items-center space-x-1 cursor-pointer"
                        >
                          <span>View Report</span>
                          <svg className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>

                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white px-6 py-4 border-t border-slate-100 mt-4 rounded-2xl shadow-sm">
                <div className="text-xs font-semibold text-slate-500">
                  Showing <span className="text-slate-800 font-bold">{Math.min(filteredCompanies.length, (currentPage - 1) * itemsPerPage + 1)}</span> to{' '}
                  <span className="text-slate-800 font-bold">{Math.min(filteredCompanies.length, currentPage * itemsPerPage)}</span> of{' '}
                  <span className="text-slate-800 font-bold">{filteredCompanies.length}</span> tickers
                </div>
                
                <div className="flex items-center space-x-2">
                  {/* Prev Button */}
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-slate-50 text-slate-650 font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer text-xs flex items-center space-x-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Previous</span>
                  </button>

                  {/* Page numbers range helper */}
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                      if (totalPages > 5) {
                        if (page !== 1 && page !== totalPages && Math.abs(page - currentPage) > 1) {
                          if (page === 2 && currentPage > 3) {
                            return <span key="dots-prev" className="px-1.5 text-slate-400 font-bold">...</span>;
                          }
                          if (page === totalPages - 1 && currentPage < totalPages - 2) {
                            return <span key="dots-next" className="px-1.5 text-slate-400 font-bold">...</span>;
                          }
                          return null;
                        }
                      }
                      
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            currentPage === page
                              ? 'bg-blue-600 text-white shadow-sm border-transparent'
                              : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-slate-50 text-slate-650 font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer text-xs flex items-center space-x-1"
                  >
                    <span>Next</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

    </div>
  );
}
