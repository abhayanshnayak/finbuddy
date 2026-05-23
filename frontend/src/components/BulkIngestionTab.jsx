import React, { useState, useEffect } from 'react';
import { formatLargeNumber } from '../utils/formatters';

export default function BulkIngestionTab({ onViewTicker }) {
  const [bulkInput, setBulkInput] = useState('');
  const [bulkTagsInput, setBulkTagsInput] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState(null);
  const [batchStatus, setBatchStatus] = useState(null);
  const [bulkForceFresh, setBulkForceFresh] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'completed', 'failed', 'pending', 'processing'
  const [expandedErrors, setExpandedErrors] = useState({}); // { [ticker]: boolean }


  const startBulkIngestion = async (e) => {
    e.preventDefault();
    setBulkError('');
    setBatchStatus(null);
    setActiveBatchId(null);
    setExpandedErrors({});
    
    // Parse and clean tickers (split by spaces, commas, or newlines)
    const rawTickers = bulkInput
      .split(/[\s,\n]+/)
      .map(t => t.trim().toUpperCase())
      .filter(Boolean);
      
    // Parse tags
    const rawTags = bulkTagsInput
      .split(/[\s,\n]+/)
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);
      
    if (rawTickers.length === 0) {
      setBulkError('Please enter at least one stock ticker.');
      return;
    }
    
    if (rawTickers.length > 500) {
      setBulkError(`Maximum batch size is 500 tickers. You entered ${rawTickers.length}.`);
      return;
    }
    
    // Validate ticker format
    const tickerRegex = /^[A-Z0-9.-]+$/;
    const invalidTickers = rawTickers.filter(t => !tickerRegex.test(t));
    if (invalidTickers.length > 0) {
      setBulkError(`Invalid characters or formats in tickers: ${invalidTickers.slice(0, 5).join(', ')}${invalidTickers.length > 5 ? '...' : ''}`);
      return;
    }
    
    setBulkLoading(true);
    
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      console.log("Sending payload to batch API:", { tickers: rawTickers, force_fresh: bulkForceFresh, tags: rawTags });
      const response = await fetch(`${apiBase}/api/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tickers: rawTickers, force_fresh: bulkForceFresh, tags: rawTags }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to submit bulk ingestion batch.');
      }
      
      const data = await response.json();
      setActiveBatchId(data.batch_id);
      setBatchStatus(data);
    } catch (err) {
      setBulkError(err.message);
    } finally {
      setBulkLoading(false);
    }
  };

  // Polling loop for active batch updates
  useEffect(() => {
    if (!activeBatchId) return;
    
    let intervalId;
    
    const pollStatus = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const response = await fetch(`${apiBase}/api/batch/${activeBatchId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch batch status.');
        }
        const data = await response.json();
        setBatchStatus(data);
        
        // Check if finished
        const completedCount = data.completed_count || 0;
        const failedCount = data.failed_count || 0;
        const total = data.total_symbols || 0;
        const isFinished = data.status === 'completed' || (completedCount + failedCount === total);
        
        if (isFinished) {
          clearInterval(intervalId);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };
    
    pollStatus();
    intervalId = setInterval(pollStatus, 2000);
    
    return () => clearInterval(intervalId);
  }, [activeBatchId]);

  // Load sample data helpers
  const loadStandardSample = () => {
    setBulkInput('AAPL, MSFT, GOOGL, INVALID123, AMZN, NFLX');
    setBulkError('');
  };

  const loadLargeSample = () => {
    setBulkInput('AAPL, MSFT, GOOGL, AMZN, NFLX, NVDA, META, TSLA, COST, WMT, PEP, KO, ADBE, ORCL, INVALID123');
    setBulkError('');
  };

  const toggleErrorDetail = (tickerSym) => {
    setExpandedErrors(prev => ({
      ...prev,
      [tickerSym]: !prev[tickerSym]
    }));
  };

  // Filter batch symbols based on query and status filter
  const getFilteredSymbols = () => {
    if (!batchStatus || !batchStatus.symbols) return [];
    
    return Object.entries(batchStatus.symbols).filter(([sym, data]) => {
      // 1. Search filter
      const searchTerms = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
      
      const tickerLower = sym.toLowerCase();
      const tags = data.tags || [];
      const tagsString = tags.join(' ').toLowerCase();

      // For multiple tags in searchQuery, check if ALL terms match either ticker or tags
      const matchesSearch = searchTerms.length === 0 || searchTerms.every(term => 
        tickerLower.includes(term) || tagsString.includes(term)
      );
      
      // 2. Status filter
      let matchesStatus = true;
      if (statusFilter === 'completed') {
        matchesStatus = data.status === 'completed';
      } else if (statusFilter === 'failed') {
        matchesStatus = data.status === 'failed';
      } else if (statusFilter === 'pending') {
        matchesStatus = data.status === 'pending';
      } else if (statusFilter === 'processing') {
        matchesStatus = data.status === 'processing';
      }
      
      return matchesSearch && matchesStatus;
    });
  };

  // Count helper for badge filters
  const getFilterCounts = () => {
    const counts = { all: 0, completed: 0, failed: 0, pending: 0, processing: 0 };
    if (!batchStatus || !batchStatus.symbols) return counts;
    
    Object.values(batchStatus.symbols).forEach(data => {
      counts.all++;
      if (data.status === 'completed') counts.completed++;
      else if (data.status === 'failed') counts.failed++;
      else if (data.status === 'pending') counts.pending++;
      else if (data.status === 'processing') counts.processing++;
    });
    return counts;
  };

  const filterCounts = getFilterCounts();
  const filteredSymbols = getFilteredSymbols();
  const totalSymbols = batchStatus?.total_symbols || 0;
  const processedCount = (batchStatus?.completed_count || 0) + (batchStatus?.failed_count || 0);
  const percentComplete = totalSymbols > 0 ? Math.round((processedCount / totalSymbols) * 100) : 0;

  return (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Input Submission Card */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Bulk Stock Ingestion Pipeline</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Queue and process up to 500 stock symbols. Tickers are queued, rate-limited at 20 requests/minute, and cached directly in Firestore.
                </p>
              </div>

              <form onSubmit={startBulkIngestion} className="space-y-4">
                <div className="relative">
                  <textarea
                    rows={4}
                    value={bulkInput}
                    onChange={(e) => {
                      setBulkInput(e.target.value);
                      if (bulkError) setBulkError('');
                    }}
                    placeholder="Enter stock symbols separated by commas, spaces, or newlines (e.g. AAPL, MSFT, TSLA, NFLX, GOOGL)..."
                    className="w-full px-5 py-4 border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-2xl outline-none transition-all shadow-inner text-gray-850 placeholder-gray-405 font-mono text-sm leading-relaxed"
                  />
                  {bulkInput.trim() && (
                    <div className="absolute bottom-4 right-4 flex items-center space-x-2 bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg text-xs font-semibold text-slate-600">
                      <span>Count: {bulkInput.split(/[\s,\n]+/).filter(Boolean).length}</span>
                      {bulkInput.split(/[\s,\n]+/).filter(Boolean).length > 500 && (
                        <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                      )}
                    </div>
                  )}
                </div>
                
                <div className="relative">
                  <input
                    type="text"
                    value={bulkTagsInput}
                    onChange={(e) => setBulkTagsInput(e.target.value)}
                    placeholder="Optional: Enter tags (e.g. tech, growth, large-cap)..."
                    className="w-full px-5 py-3 border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-xl outline-none transition-all shadow-inner text-gray-850 placeholder-gray-405 font-mono text-sm"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="bulkForceFresh"
                    checked={bulkForceFresh}
                    onChange={(e) => setBulkForceFresh(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="bulkForceFresh" className="text-sm font-medium text-gray-700">
                    Force Fresh Data for all symbols (Bypass Cache)
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={loadStandardSample}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors"
                    >
                      Load Sample (6 Tickers)
                    </button>
                    <button
                      type="button"
                      onClick={loadLargeSample}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors"
                    >
                      Load Large Batch (15 Tickers)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkInput('')}
                      className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-650 text-xs font-semibold rounded-lg border border-red-100 transition-colors"
                    >
                      Clear
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={bulkLoading || !bulkInput.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300 font-semibold rounded-xl flex items-center justify-center space-x-2 disabled:opacity-40"
                  >
                    {bulkLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span>Dispatching...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>Start Ingestion Pipeline</span>
                      </>
                    )}
                  </button>
                </div>

                {bulkError && (
                  <div className="flex items-center space-x-2 bg-red-50 text-red-700 border border-red-100 rounded-xl px-4 py-2.5 text-sm font-medium mt-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 10 2 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>{bulkError}</span>
                  </div>
                )}
              </form>
            </div>

            {/* Ingestion Dashboard / Status Progress Panel */}
            {batchStatus && (
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
                
                {/* Header info */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-5 gap-4">
                  <div>
                    <div className="flex items-center space-x-2.5">
                      <h3 className="text-xl font-bold text-gray-800">Pipeline Execution Monitor</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                        batchStatus.status === 'completed' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : batchStatus.status === 'processing_locally' 
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                      }`}>
                        {batchStatus.status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 mt-1.5 text-xs text-gray-400 font-medium">
                      <span>Batch ID:</span>
                      <code className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-mono text-[10px] select-all">{batchStatus.batch_id}</code>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-500">Overall Progress</p>
                    <p className="text-2xl font-extrabold text-blue-600 mt-0.5">{percentComplete}%</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-gray-500 font-bold">
                    <span>INGESTED {processedCount} OF {totalSymbols} SYMBOLS</span>
                    <span>{percentComplete}% COMPLETE</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden border border-slate-250/20 shadow-inner">
                    <div
                      style={{ width: `${percentComplete}%` }}
                      className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end"
                    >
                      {percentComplete > 8 && (
                        <div className="w-1.5 h-1.5 bg-white rounded-full mr-1.5 shadow animate-ping" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Stat Grid Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl shadow-sm text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">Total Queue</p>
                    <p className="text-3xl font-extrabold text-slate-800 mt-1.5">{totalSymbols}</p>
                  </div>

                  <div className="p-4 bg-emerald-50/40 border border-emerald-100/50 rounded-2xl shadow-sm text-center">
                    <p className="text-[10px] text-emerald-500 uppercase tracking-wider font-extrabold">Ingested (Cached)</p>
                    <p className="text-3xl font-extrabold text-emerald-600 mt-1.5">{batchStatus.completed_count || 0}</p>
                  </div>

                  <div className="p-4 bg-rose-50/40 border border-rose-100/50 rounded-2xl shadow-sm text-center">
                    <p className="text-[10px] text-rose-500 uppercase tracking-wider font-extrabold">Failed Errors</p>
                    <p className="text-3xl font-extrabold text-rose-600 mt-1.5">{batchStatus.failed_count || 0}</p>
                  </div>

                  <div className="p-4 bg-amber-50/40 border border-amber-100/50 rounded-2xl shadow-sm text-center">
                    <p className="text-[10px] text-amber-500 uppercase tracking-wider font-extrabold">Pending Queue</p>
                    <p className="text-3xl font-extrabold text-amber-600 mt-1.5">
                      {filterCounts.pending + filterCounts.processing}
                    </p>
                  </div>
                </div>

                {/* Search & Filter bar for Batch Symbols */}
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
                    <h4 className="text-base font-bold text-gray-800 flex items-center space-x-2">
                      <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <span>Task Processing Breakdown</span>
                    </h4>

                    {/* Filter Action Tabs */}
                    <div className="flex overflow-x-auto gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <button
                        onClick={() => setStatusFilter('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          statusFilter === 'all'
                            ? 'bg-white text-blue-700 shadow-sm font-bold'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        All ({filterCounts.all})
                      </button>
                      <button
                        onClick={() => setStatusFilter('completed')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          statusFilter === 'completed'
                            ? 'bg-white text-emerald-700 shadow-sm font-bold'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        Ingested ({filterCounts.completed})
                      </button>
                      <button
                        onClick={() => setStatusFilter('failed')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          statusFilter === 'failed'
                            ? 'bg-white text-rose-700 shadow-sm font-bold'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        Failed ({filterCounts.failed})
                      </button>
                      <button
                        onClick={() => setStatusFilter('processing')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          statusFilter === 'processing'
                            ? 'bg-white text-amber-700 shadow-sm font-bold'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        Processing ({filterCounts.processing})
                      </button>
                      <button
                        onClick={() => setStatusFilter('pending')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          statusFilter === 'pending'
                            ? 'bg-white text-slate-700 shadow-sm font-bold'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        Queued ({filterCounts.pending})
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search ticker symbols (e.g. AAPL)..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-inner text-sm"
                    />
                    <svg className="w-5 h-5 text-gray-400 absolute left-3.5 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* Symbols List */}
                <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-inner bg-slate-50/50">
                  <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 scrollbar-thin">
                    {filteredSymbols.length === 0 ? (
                      <div className="text-center py-10 text-gray-400 text-sm font-medium">
                        No ticker tasks match the selected query or filters.
                      </div>
                    ) : (
                      filteredSymbols.map(([sym, item]) => (
                        <div key={sym} className="hover:bg-slate-50 transition-colors p-4 space-y-3">
                          <div className="flex items-center justify-between gap-4">
                            
                            {/* Left part: Symbol and timestamp */}
                            <div className="flex items-center space-x-3">
                              <span className="text-base font-extrabold text-slate-800 tracking-wide font-mono bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">{sym}</span>
                              {item.tags && item.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {item.tags.map(tag => (
                                    <span key={tag} className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {item.timestamp && (
                                <span className="text-[10px] text-gray-400 font-semibold uppercase">
                                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                              )}
                            </div>

                            {/* Middle part: status indicator pill */}
                            <div className="flex items-center space-x-2">
                              {item.status === 'completed' && (
                                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm">
                                  <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                  </svg>
                                  <span>Ingested</span>
                                </span>
                              )}

                              {item.status === 'processing' && (
                                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100 shadow-sm">
                                  <svg className="animate-spin h-3.5 w-3.5 text-amber-600" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                  <span className="animate-pulse">Processing...</span>
                                </span>
                              )}

                              {item.status === 'pending' && (
                                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200 shadow-sm">
                                  <span className="w-2 h-2 bg-slate-400 rounded-full" />
                                  <span>Queued</span>
                                </span>
                              )}

                              {item.status === 'failed' && (
                                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100 shadow-sm">
                                  <svg className="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                  </svg>
                                  <span>Failed</span>
                                </span>
                              )}
                            </div>

                            {/* Right part: Actions */}
                            <div>
                              {item.status === 'completed' && (
                                <button
                                  onClick={() => viewSingleTicker(sym)}
                                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white text-xs font-bold rounded-lg border border-blue-200 transition-all duration-300 flex items-center space-x-1"
                                >
                                  <span>View Report</span>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                              )}

                              {item.status === 'failed' && (
                                <button
                                  onClick={() => toggleErrorDetail(sym)}
                                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white text-xs font-bold rounded-lg border border-rose-200 transition-all duration-300"
                                >
                                  {expandedErrors[sym] ? 'Hide Error' : 'Show Error'}
                                </button>
                              )}
                            </div>

                          </div>

                          {/* Expandable Error Detail Banner */}
                          {item.status === 'failed' && expandedErrors[sym] && (
                            <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3 text-xs text-rose-700 leading-relaxed font-mono shadow-inner animate-in slide-in-from-top-2 duration-300">
                              <p className="font-bold uppercase text-[10px] text-rose-600 tracking-wider mb-1">Pipeline Ingestion Failure Logs:</p>
                              <p className="bg-white p-2.5 rounded-lg border border-rose-100 text-slate-700">{item.error || 'Unknown Pipeline Server Error'}</p>
                            </div>
                          )}

                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
  );
}
