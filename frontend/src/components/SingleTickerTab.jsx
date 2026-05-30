import React, { useState, useEffect } from 'react';
import { formatLargeNumber } from '../utils/formatters';

export default function SingleTickerTab({ initialTicker, onBack }) {
  const [ticker, setTicker] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeAuditTab, setActiveAuditTab] = useState('growth');
  const [singleForceFresh, setSingleForceFresh] = useState(false);
  const [growthAnalysis, setGrowthAnalysis] = useState(null);
  const [loadingGrowthAnalysis, setLoadingGrowthAnalysis] = useState(false);

  const fetchReport = async (e, overrideTicker) => {
    const targetTicker = overrideTicker || ticker;
    if (e) e.preventDefault();
    if (!targetTicker) return;
    
    setLoading(true);
    setError('');
    setReport(null);
    
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiBase}/api/report/${targetTicker}?force_fresh=${singleForceFresh}`);
      if (!response.ok) {
        throw new Error('Failed to fetch report or invalid ticker.');
      }
      const data = await response.json();
      setReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Growth Analysis when report changes
  useEffect(() => {
    if (report && report.ticker) {
      const fetchGrowthAnalysis = async () => {
        setLoadingGrowthAnalysis(true);
        try {
          const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
          const response = await fetch(`${apiBase}/api/stocks/${report.ticker}/growth-analysis?force_fresh=${singleForceFresh}`);
          if (response.ok) {
            const data = await response.json();
            setGrowthAnalysis(data);
          } else {
             setGrowthAnalysis(null);
          }
        } catch (err) {
          console.error("Error fetching growth analysis:", err);
          setGrowthAnalysis(null);
        } finally {
          setLoadingGrowthAnalysis(false);
        }
      };
      fetchGrowthAnalysis();
    } else {
      setGrowthAnalysis(null);
    }
  }, [report, singleForceFresh]);



  useEffect(() => {
    if (initialTicker) {
      setTicker(initialTicker);
      fetchReport({ preventDefault: () => {} }, initialTicker);
    }
  }, [initialTicker]);

  const windageDetails = report?.financials?.valuations?.computation_windage_details;

  // Prepare combined last 10 years of OCF and Net Income data
  const ocfHistory = report?.financials?.raw_data?.operating_cash_flow_history || [];
  const niHistory = report?.financials?.raw_data?.net_income_history || [];
  const last10Ocf = ocfHistory.slice(-10);
  const combinedHistory = last10Ocf.map(ocfItem => {
    const niItem = niHistory.find(ni => ni.year === ocfItem.year);
    return {
      year: ocfItem.year,
      ocfValue: ocfItem.value,
      niValue: niItem ? niItem.value : null
    };
  });

  return (
          <div className="space-y-8 animate-in fade-in duration-300">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center space-x-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border border-slate-200 hover:border-slate-300 shadow-sm transition-all duration-205 self-start cursor-pointer group"
              >
                <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back to Search Results</span>
              </button>
            )}
            {/* Search Dashboard Box */}
            <div className="flex flex-col items-center justify-center space-y-4 py-12 bg-white rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-800">Analyze a Company</h2>
              <p className="text-sm text-gray-400 max-w-md text-center">
                Enter a single ticker symbol to generate real-time quantitative audits, conservative MOS valuations, and AI confirmation bias checks.
              </p>
              
              <form onSubmit={fetchReport} className="w-full max-w-md flex flex-col space-y-4 mt-4 px-4">
                <div className="flex space-x-2 w-full">
                  <input
                    type="text"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    placeholder="Enter Stock Ticker (e.g. AAPL)"
                    className="flex-1 px-5 py-3 border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-xl outline-none transition-all shadow-inner text-gray-800 font-semibold"
                  />
                  <button
                    type="submit"
                    disabled={loading || !ticker}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 hover:shadow-lg transition-all duration-200 font-semibold rounded-xl flex items-center justify-center min-w-[120px] disabled:opacity-50"
                  >
                    {loading ? (
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      "Analyze"
                    )}
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="singleForceFresh"
                    checked={singleForceFresh}
                    onChange={(e) => setSingleForceFresh(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="singleForceFresh" className="text-sm font-medium text-gray-700">
                    Bypass Cache (Force Fresh Data)
                  </label>
                </div>
              </form>
              {error && (
                <div className="flex items-center space-x-2 bg-red-50 text-red-700 border border-red-100 rounded-xl px-4 py-2.5 text-sm font-medium mt-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 10 2 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Report Dashboard */}
            {report && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">{report.name} ({report.ticker})</h2>
                    <p className="text-gray-500 mt-1 font-medium">
                      {report.industry} | <span className="text-blue-600">{report.sector}</span> | <span className="text-indigo-600">{report.subsector}</span> | <span className="text-emerald-600">{report.industry_group}</span>
                    </p>
                    {report.tags && report.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3 mb-1">
                        {report.tags.map((tag, idx) => (
                          <span key={idx} className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-semibold rounded-lg border border-purple-200">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center space-x-4 mt-2">
                      <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-full shadow-sm">
                        Price at Analysis: <span className="text-gray-900">${report.price_at_storage?.toFixed(2)}</span>
                      </span>
                      <span className="text-xs font-medium text-gray-500 flex items-center">
                        <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Fetched At: {report.last_updated_pst?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="bg-blue-50 text-blue-700 font-bold px-4 py-2 rounded-xl border border-blue-100">
                    Cached / Verified
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Valuations Card */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                    <h3 className="text-xl font-semibold text-gray-900 border-b pb-2">Valuations (Margin of Safety)</h3>
                    {report.financials.valuations.windage_fallback_message && (
                      <div className="bg-blue-50 text-blue-800 text-xs font-semibold px-3 py-2 rounded-lg border border-blue-100 flex items-center space-x-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span>{report.financials.valuations.windage_fallback_message}</span>
                      </div>
                    )}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center bg-gradient-to-r from-emerald-50 to-green-50 p-4 rounded-xl border border-green-100">
                        <div>
                          <span className="text-xs font-semibold text-green-800 uppercase tracking-wider block">MOS Buy Price</span>
                          <span className="text-3xl font-extrabold text-green-700">${report.financials.valuations.margin_of_safety_price?.toFixed(2)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-gray-500 block">Sticker Price</span>
                          <span className="text-lg font-semibold text-gray-700">${(report.financials.valuations.margin_of_safety_price * 2)?.toFixed(2)}</span>
                        </div>
                      </div>
                      
                      {report.financials.valuations.computation_mos_details && (
                        <div className="space-y-2">
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start space-x-3">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                            <div className="flex-1">
                              <p className="text-[11px] font-semibold text-gray-700">Future EPS (10 Years)</p>
                              <p className="text-[10px] text-gray-500 font-mono mt-0.5">{report.financials.valuations.computation_mos_details.step_1_future_eps}</p>
                            </div>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start space-x-3">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                            <div className="flex-1">
                              <p className="text-[11px] font-semibold text-gray-700">Future Price Estimate</p>
                              <p className="text-[10px] text-gray-500 font-mono mt-0.5">{report.financials.valuations.computation_mos_details.step_2_future_price}</p>
                            </div>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start space-x-3">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                            <div className="flex-1">
                              <p className="text-[11px] font-semibold text-gray-700">Sticker Price (Discounted)</p>
                              <p className="text-[10px] text-gray-500 font-mono mt-0.5">{report.financials.valuations.computation_mos_details.step_3_sticker_price}</p>
                            </div>
                          </div>
                          <div className="p-3 bg-gradient-to-r from-green-50/50 to-emerald-50/50 rounded-xl border border-green-100/80 flex items-start space-x-3">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-200 text-green-800 text-xs font-bold flex items-center justify-center mt-0.5">4</span>
                            <div className="flex-1">
                              <p className="text-[11px] font-semibold text-green-900">Apply 50% Margin of Safety</p>
                              <p className="text-[10px] text-green-700 font-mono mt-0.5">{report.financials.valuations.computation_mos_details.step_4_mos_price}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payback Time Valuation Card */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                      <h3 className="text-xl font-semibold text-gray-900">Valuations (Payback Time)</h3>
                      <span className="text-sm font-medium text-gray-500">
                        Market Cap: <span className="text-gray-900 font-bold">${formatLargeNumber(report.financials.valuations.market_cap)}</span>
                      </span>
                    </div>
                    {report.financials.valuations.windage_fallback_message && (
                      <div className="bg-blue-50 text-blue-800 text-xs font-semibold px-3 py-2 rounded-lg border border-blue-100 flex items-center space-x-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span>{report.financials.valuations.windage_fallback_message}</span>
                      </div>
                    )}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
                        <div>
                          <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider block">Payback Time</span>
                          <span className="text-3xl font-extrabold text-blue-700">
                            {report.financials.valuations.payback_time_years > 0 
                              ? `${report.financials.valuations.payback_time_years} Years` 
                              : "10+ Years"}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-gray-500 block">Status</span>
                          <span className={`text-lg font-semibold ${report.financials.valuations.payback_time_years > 0 && report.financials.valuations.payback_time_years <= 8 ? 'text-green-600' : 'text-amber-600'}`}>
                            {report.financials.valuations.payback_time_years > 0 && report.financials.valuations.payback_time_years <= 8 ? "Pass" : "Fail"}
                          </span>
                        </div>
                      </div>
                      
                      {report.financials.valuations.projected_fcf_per_year?.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="text-[11px] font-semibold text-gray-700 ml-1">10-Year FCF Projection</span>
                            <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold bg-white px-2 py-0.5 rounded shadow-sm border border-gray-100">
                              Growth: {(report.financials.valuations.windage_growth_rate_used * 100).toFixed(1)}%
                            </span>
                          </div>
                          
                          <div className="max-h-[140px] overflow-y-auto pr-1 custom-scrollbar border border-gray-100 rounded-xl">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-gray-50 text-gray-500 sticky top-0 shadow-sm">
                                <tr>
                                  <th className="p-2 font-medium rounded-tl-xl text-center w-12 border-b border-gray-200">Yr</th>
                                  <th className="p-2 font-medium text-right rounded-tr-xl border-b border-gray-200">Proj. FCF</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {report.financials.valuations.projected_fcf_per_year.map((proj) => (
                                  <tr key={proj.year} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-2 text-center text-gray-400 font-medium">{proj.year}</td>
                                    <td className="p-2 text-right font-mono text-gray-700 font-medium">
                                      {proj.fcf < 0 
                                        ? `-$${formatLargeNumber(Math.abs(proj.fcf))}` 
                                        : `$${formatLargeNumber(proj.fcf)}`}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100/50 flex items-start space-x-2 mt-2">
                            <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="whitespace-pre-wrap text-[10px] text-amber-800 leading-relaxed font-medium">
                              {report.financials.valuations.computation_payback_details}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Alternative Metrics */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4 md:col-span-2">
                    <h3 className="text-xl font-semibold text-gray-900 border-b pb-2">Alternative Valuation Metrics</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex flex-col space-y-2">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-semibold text-gray-700">Rule of 40 ({report.financials.derived_metrics.computation_rule_of_40_details?.latest_year})</p>
                            <p className="text-[10px] text-gray-500">Revenue Growth + FCF Margin</p>
                          </div>
                          <span className={`text-xl font-bold font-mono ${report.financials.derived_metrics.rule_of_40 >= 40 ? 'text-green-600' : 'text-amber-600'}`}>
                            {report.financials.derived_metrics.rule_of_40?.toFixed(1)}
                          </span>
                        </div>
                        {report.financials.derived_metrics.computation_rule_of_40_details && (
                          <div className="text-[10px] text-gray-500 bg-white p-2 rounded border border-gray-100">
                            <p className="mb-1">{report.financials.derived_metrics.computation_rule_of_40_details.explanation}</p>
                            <p className="font-mono text-gray-600">
                              {(report.financials.derived_metrics.computation_rule_of_40_details.revenue_growth_1yr * 100).toFixed(1)}% <span className="text-[9px] text-gray-400">(Rev: ${formatLargeNumber(report.financials.derived_metrics.computation_rule_of_40_details.latest_revenue)})</span> + {(report.financials.derived_metrics.computation_rule_of_40_details.fcf_margin * 100).toFixed(1)}% <span className="text-[9px] text-gray-400">(FCF: ${formatLargeNumber(report.financials.derived_metrics.computation_rule_of_40_details.latest_fcf)})</span>
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex flex-col space-y-2">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-semibold text-gray-700">EV / Revenue ({report.financials.derived_metrics.computation_ev_to_revenue_details?.latest_year})</p>
                            <p className="text-[10px] text-gray-500">Enterprise Value to Sales</p>
                          </div>
                          <span className="text-xl font-bold font-mono text-gray-700">
                            {report.financials.derived_metrics.ev_to_revenue?.toFixed(2)}x
                          </span>
                        </div>
                        {report.financials.derived_metrics.computation_ev_to_revenue_details && (
                          <div className="text-[10px] text-gray-500 bg-white p-2 rounded border border-gray-100">
                            <p className="mb-1">{report.financials.derived_metrics.computation_ev_to_revenue_details.explanation}</p>
                            <p className="font-mono text-gray-600">
                              EV: ${formatLargeNumber(report.financials.derived_metrics.computation_ev_to_revenue_details.enterprise_value)} / Rev: ${formatLargeNumber(report.financials.derived_metrics.computation_ev_to_revenue_details.latest_revenue)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Core Growth Indicators */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4 md:col-span-2">
                    <h3 className="text-xl font-semibold text-gray-900 border-b pb-2">Big 4 Growth Rates</h3>
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="p-2 rounded-l-lg">Metric</th>
                          <th className="p-2 text-right">1Y</th>
                          <th className="p-2 text-right">3Y</th>
                          <th className="p-2 text-right">5Y</th>
                          <th className="p-2 text-right rounded-r-lg">10Y</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(report.financials.derived_metrics.growth_rates_1_3_5_10_yr || {}).map(([key, rates]) => (
                          <tr key={key} className="border-b border-gray-55 last:border-0 hover:bg-slate-50/40">
                            <td className="p-2 font-medium capitalize">{key.replace(/_/g, ' ')}</td>
                            {rates.map((rate, i) => (
                              <td key={i} className={`p-2 text-right font-mono font-semibold ${rate >= 0.10 ? 'text-green-600' : 'text-red-505'}`}>
                                {(rate * 100).toFixed(1)}%
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Calculation Transparency & Audit Log */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 space-y-2 md:space-y-0">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 flex items-center">
                        <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        Calculation Transparency & Audit Log
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">Granular step-by-step mathematical logic and data points for verification</p>
                    </div>
                    
                    <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl self-start md:self-auto">
                      <button
                        onClick={() => setActiveAuditTab('growth')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          activeAuditTab === 'growth'
                            ? 'bg-white text-blue-700 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Windage Growth Rate
                      </button>
                      <button
                        onClick={() => setActiveAuditTab('pe')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          activeAuditTab === 'pe'
                            ? 'bg-white text-blue-700 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Windage PE
                      </button>
                    </div>
                  </div>

                  {/* Tab Contents */}
                  {activeAuditTab === 'growth' && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      {report.financials.valuations.windage_fallback_message ? (
                        <>
                          <div className="bg-amber-50/60 border border-amber-200 p-5 rounded-2xl space-y-3">
                            <div className="flex items-center space-x-2 text-amber-800">
                              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <h4 className="font-bold text-sm">Operating Cash Flow CAGR Fallback Triggered</h4>
                            </div>
                            <p className="text-xs text-amber-700 leading-relaxed">
                              {report.financials.derived_metrics?.computation_windage || "OCF CAGR was negative or mathematically undefined, so the system fell back to the 10-year Net Income growth rate."}
                            </p>
                            <div className="p-4 bg-white border border-amber-100 rounded-xl flex justify-between items-center max-w-sm">
                              <span className="text-xs font-semibold text-gray-500">10-Year Net Income CAGR (Fallback)</span>
                              <span className="text-lg font-bold text-amber-600 font-mono">{(report.financials.valuations.windage_growth_rate_used * 100).toFixed(2)}%</span>
                            </div>
                          </div>

                          {/* Historical OCF and Net Income side-by-side Table for Fallback */}
                          <div className="mt-4 space-y-2">
                            <h4 className="text-xs font-bold text-gray-700">Historical Metrics (Last 10 Years)</h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs text-left border border-gray-100 rounded-lg">
                                <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider text-[10px]">
                                  <tr>
                                    <th className="p-3">Year</th>
                                    <th className="p-3 text-right">Operating Cash Flow</th>
                                    <th className="p-3 text-right">Net Income</th>
                                    <th className="p-3 text-center">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {combinedHistory.map((item, idx) => {
                                    const niHistorySlice = niHistory.slice(-10);
                                    const isStart = niHistorySlice.length > 0 && item.year === niHistorySlice[0].year;
                                    const isEnd = niHistorySlice.length > 0 && item.year === niHistorySlice[niHistorySlice.length - 1].year;
                                    return (
                                      <tr key={idx} className={`hover:bg-slate-50/55 ${isStart || isEnd ? 'bg-amber-50/20 font-semibold text-amber-900' : 'text-gray-600'}`}>
                                        <td className="p-3">
                                          {item.year}
                                          {isStart && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-100 text-amber-800">NI Start</span>}
                                          {isEnd && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-200 text-amber-900">NI End</span>}
                                        </td>
                                        <td className="p-3 text-right font-mono text-gray-400">
                                          {item.ocfValue < 0 ? '-' : ''}${formatLargeNumber(Math.abs(item.ocfValue))}
                                        </td>
                                        <td className="p-3 text-right font-mono font-semibold text-amber-700">
                                          {item.niValue !== null ? (
                                            <>{item.niValue < 0 ? '-' : ''}${formatLargeNumber(Math.abs(item.niValue))}</>
                                          ) : (
                                            '-'
                                          )}
                                        </td>
                                        <td className="p-3 text-center">
                                          {isStart || isEnd ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                              Used for NI CAGR
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-400">
                                              Reference
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      ) : windageDetails?.is_cagr ? (
                        <>
                          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50 text-sm text-blue-800">
                            <p className="font-semibold mb-1">How is Windage Growth Rate Calculated?</p>
                            <p className="text-xs text-blue-700 leading-relaxed">
                              We calculate the <strong>Compound Annual Growth Rate (CAGR)</strong> of Operating Cash Flow (OCF) over the last 10 years.<br />
                              Formula: <code className="bg-blue-100 px-1.5 py-0.5 rounded font-bold text-blue-900 font-mono text-[11px]">CAGR = (Ending OCF / Starting OCF) ^ (1 / Years) - 1</code>
                            </p>
                          </div>

                          {/* CAGR Stats Cards */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 bg-white border border-gray-150 rounded-xl text-center shadow-sm">
                              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Starting OCF ({windageDetails?.start_year})</p>
                              <p className="text-lg font-extrabold text-gray-800 mt-1 font-mono">
                                {windageDetails?.start_value < 0 ? '-' : ''}${formatLargeNumber(Math.abs(windageDetails?.start_value || 0))}
                              </p>
                            </div>
                            <div className="p-4 bg-white border border-gray-150 rounded-xl text-center shadow-sm">
                              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Ending OCF ({windageDetails?.end_year})</p>
                              <p className="text-lg font-extrabold text-gray-800 mt-1 font-mono">
                                {windageDetails?.end_value < 0 ? '-' : ''}${formatLargeNumber(Math.abs(windageDetails?.end_value || 0))}
                              </p>
                            </div>
                            <div className="p-4 bg-white border border-gray-150 rounded-xl text-center shadow-sm">
                              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Duration</p>
                              <p className="text-lg font-extrabold text-gray-800 mt-1 font-mono">
                                {windageDetails?.years} Years
                              </p>
                            </div>
                            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-150 rounded-xl text-center shadow-sm">
                              <p className="text-[10px] text-blue-800 uppercase tracking-wider font-bold">Calculated CAGR</p>
                              <p className="text-lg font-extrabold text-blue-700 mt-1 font-mono">
                                {(windageDetails?.cagr * 100).toFixed(2)}%
                              </p>
                            </div>
                          </div>

                          {/* Historical Table */}
                          <div className="mt-4 space-y-2">
                            <h4 className="text-xs font-bold text-gray-700">Historical Metrics (Last 10 Years)</h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs text-left border border-gray-100 rounded-lg">
                                <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider text-[10px]">
                                  <tr>
                                    <th className="p-3">Year</th>
                                    <th className="p-3 text-right">Operating Cash Flow</th>
                                    <th className="p-3 text-right">Net Income</th>
                                    <th className="p-3 text-center">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {combinedHistory.map((item, idx) => {
                                    const isStart = item.year === windageDetails?.start_year;
                                    const isEnd = item.year === windageDetails?.end_year;
                                    return (
                                      <tr key={idx} className={`hover:bg-slate-50/55 ${isStart || isEnd ? 'bg-blue-50/20 font-semibold text-blue-900' : 'text-gray-600'}`}>
                                        <td className="p-3">
                                          {item.year}
                                          {isStart && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-100 text-blue-800">Start Year</span>}
                                          {isEnd && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-indigo-100 text-indigo-800">End Year</span>}
                                        </td>
                                        <td className="p-3 text-right font-mono font-semibold text-blue-700">
                                          {item.ocfValue < 0 ? '-' : ''}${formatLargeNumber(Math.abs(item.ocfValue))}
                                        </td>
                                        <td className="p-3 text-right font-mono text-gray-500">
                                          {item.niValue !== null ? (
                                            <>{item.niValue < 0 ? '-' : ''}${formatLargeNumber(Math.abs(item.niValue))}</>
                                          ) : (
                                            '-'
                                          )}
                                        </td>
                                        <td className="p-3 text-center">
                                          {isStart || isEnd ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-150 text-green-800">
                                              Used for CAGR
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-400">
                                              Reference
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50 text-sm text-blue-800">
                            <p className="font-semibold mb-1">How is Windage Growth Rate Calculated?</p>
                            <p className="text-xs text-blue-700 leading-relaxed">
                              1. We compute year-over-year (YoY) Operating Cash Flow (OCF) growth rates for up to the last 10 years.<br />
                              2. We calculate the mean and standard deviation of all YoY rates.<br />
                              3. To ensure stable growth projections, we filter out outliers (rates outside <strong>1 standard deviation</strong> from the mean).<br />
                              4. The final Windage Growth Rate is the average of the remaining (non-outlier) rates: <strong className="text-blue-900">{(windageDetails?.final_rate * 100).toFixed(2)}%</strong>.
                            </p>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left border border-gray-100 rounded-lg">
                              <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider text-[10px]">
                                <tr>
                                  <th className="p-3">Period</th>
                                  <th className="p-3 text-right">Start OCF</th>
                                  <th className="p-3 text-right">End OCF</th>
                                  <th className="p-3 text-right">Calculated YoY</th>
                                  <th className="p-3 text-center">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {windageDetails?.steps?.map((step, idx) => (
                                  <tr key={idx} className={`hover:bg-slate-50/55 ${!step.is_included ? 'bg-amber-50/20 text-gray-400' : 'text-gray-700'}`}>
                                    <td className="p-3 font-medium">{step.from_year} → {step.to_year}</td>
                                    <td className="p-3 text-right font-mono">
                                      {step.prev_value < 0 
                                        ? `-$${formatLargeNumber(Math.abs(step.prev_value))}` 
                                        : step.prev_value >= 1000 
                                          ? `$${formatLargeNumber(step.prev_value)}` 
                                          : `$${step.prev_value.toFixed(2)}`}
                                    </td>
                                    <td className="p-3 text-right font-mono">
                                      {step.curr_value < 0 
                                        ? `-$${formatLargeNumber(Math.abs(step.curr_value))}` 
                                        : step.curr_value >= 1000 
                                          ? `$${formatLargeNumber(step.curr_value)}` 
                                          : `$${step.curr_value.toFixed(2)}`}
                                    </td>
                                    <td className="p-3 text-right font-mono font-semibold">
                                      {(step.rate * 100).toFixed(2)}%
                                    </td>
                                    <td className="p-3 text-center">
                                      {step.is_included ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800">
                                          Included
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800" title="Filtered out because rate is outside 1 standard deviation">
                                          Outlier (Filtered)
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {activeAuditTab === 'pe' && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50 text-sm text-blue-800">
                        <p className="font-semibold mb-1">How is Windage PE Calculated?</p>
                        <p className="text-xs text-blue-700 leading-relaxed">
                          We take the <strong>minimum</strong> of two bounds to enforce conservative valuation:<br />
                          1. The <strong>maximum P/E ratio</strong> of the last 5 years: <strong className="text-blue-900">{report.financials.valuations.computation_pe_details?.max_pe_5yr?.toFixed(2)}</strong>.<br />
                          2. <strong>2x the Windage Growth Rate</strong>: <strong className="text-blue-900">{report.financials.valuations.computation_pe_details?.two_x_growth?.toFixed(2)}</strong>.<br />
                          Formula: <code>min(max_pe_5yr, 2 * growth)</code> &rarr; Selected: <strong className="text-blue-900">{report.financials.valuations.computation_pe_details?.final_pe?.toFixed(2)}</strong>.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Historical 5-Year P/E Ratios</h4>
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                            {report.financials.valuations.computation_pe_details?.last_5_years_pe?.map((peItem, idx) => (
                              <div key={idx} className="flex justify-between items-center text-xs text-gray-700 border-b border-gray-200/50 pb-1.5 last:border-0 last:pb-0">
                                <span className="font-medium">{peItem.date}</span>
                                <span className="font-mono bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm">{peItem.pe?.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Decision Matrix</h4>
                          <div className="space-y-2.5">
                            <div className="p-3 bg-white border border-gray-200 rounded-xl flex justify-between items-center text-xs">
                              <div>
                                <p className="font-semibold text-gray-700">Max P/E (Last 5 Years)</p>
                                <p className="text-gray-400 text-[10px]">Historical ceiling</p>
                              </div>
                              <span className="text-base font-bold text-gray-700 font-mono">{report.financials.valuations.computation_pe_details?.max_pe_5yr?.toFixed(2)}</span>
                            </div>
                            <div className="p-3 bg-white border border-gray-200 rounded-xl flex justify-between items-center text-xs">
                              <div>
                                <p className="font-semibold text-gray-700">2x Growth Rate Cap</p>
                                <p className="text-gray-400 text-[10px]">{(windageDetails?.final_rate * 100).toFixed(2)}% * 2</p>
                              </div>
                              <span className="text-base font-bold text-gray-700 font-mono">{report.financials.valuations.computation_pe_details?.two_x_growth?.toFixed(2)}</span>
                            </div>
                            <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl flex justify-between items-center text-xs">
                              <div>
                                <p className="font-semibold text-blue-900">Final Selected PE (Minimum)</p>
                                <p className="text-blue-600 text-[10px]">Conservative multiple chosen</p>
                              </div>
                              <span className="text-lg font-extrabold text-blue-800 font-mono">{report.financials.valuations.computation_pe_details?.final_pe?.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* Strategic Insights */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                    <h3 className="text-xl font-semibold text-gray-900 border-b pb-2">Growth & Strategy</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{report.qualitative.growth_plans?.strategy_summary}</p>
                    {report.qualitative.growth_plans?.key_initiatives?.length > 0 && (
                      <ul className="list-disc list-inside text-sm text-gray-650 space-y-1.5 mt-2">
                        {report.qualitative.growth_plans.key_initiatives.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                    <h3 className="text-xl font-semibold text-gray-900 border-b pb-2">Challenges & Risks</h3>
                    <div className="space-y-4">
                      {report.qualitative.risks?.key_risks?.map((risk, i) => (
                        <div key={i} className="border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                          <h4 className="font-semibold text-gray-900 text-sm flex items-center space-x-1.5">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />
                            <span>{risk.risk}</span>
                          </h4>
                          <p className="text-sm text-gray-600 mt-1 leading-relaxed">{risk.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Management & Financial Health */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                  <h3 className="text-xl font-semibold text-gray-900 border-b pb-2">Management & Financial Health</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Leadership</h4>
                      <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-600">CEO Tenure</span>
                          <span className="font-semibold text-gray-800">{report.qualitative.management?.ceo_tenure_years} yrs</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-600">CEO Rating</span>
                          <span className="font-semibold text-gray-800">{report.qualitative.management?.ceo_employee_rating}/5.0</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Employee Happiness</span>
                          <span className="font-semibold text-gray-800">{report.qualitative.management?.employee_happiness_score}/5.0</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Debt Status</h4>
                      <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-600">Total Debt</span>
                          <span className="font-semibold text-gray-800">${formatLargeNumber(report.financials.raw_data?.total_debt)}</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-600">Cash & Equivalents</span>
                          <span className="font-semibold text-gray-800">${formatLargeNumber(report.financials.raw_data?.cash_and_equivalents)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Years to Payoff</span>
                          <span className="font-semibold text-gray-800">{report.financials.derived_metrics?.debt_payoff_years?.toFixed(1)} yrs</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Returns</h4>
                      <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 h-full">
                        <table className="w-full text-sm text-left">
                          <thead>
                            <tr className="text-gray-400 border-b border-gray-200">
                              <th className="pb-2 font-semibold text-xs">Metric</th>
                              <th className="pb-2 text-right font-semibold text-xs">3Y</th>
                              <th className="pb-2 text-right font-semibold text-xs">5Y</th>
                              <th className="pb-2 text-right font-semibold text-xs">10Y</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-gray-100/50">
                              <td className="py-2.5 font-medium text-gray-700">ROIC</td>
                              <td className="py-2.5 text-right font-mono font-semibold text-gray-800">{report.qualitative.management?.roic_3_yr_avg ? `${(report.qualitative.management.roic_3_yr_avg * 100).toFixed(1)}%` : '-'}</td>
                              <td className="py-2.5 text-right font-mono font-semibold text-gray-800">{report.qualitative.management?.roic_5_yr_avg ? `${(report.qualitative.management.roic_5_yr_avg * 100).toFixed(1)}%` : '-'}</td>
                              <td className="py-2.5 text-right font-mono font-semibold text-gray-800">{report.qualitative.management?.roic_10_yr_avg ? `${(report.qualitative.management.roic_10_yr_avg * 100).toFixed(1)}%` : '-'}</td>
                            </tr>
                            <tr>
                              <td className="py-2.5 font-medium text-gray-700">ROE</td>
                              <td className="py-2.5 text-right font-mono font-semibold text-gray-800">{report.qualitative.management?.roe_3_yr_avg ? `${(report.qualitative.management.roe_3_yr_avg * 100).toFixed(1)}%` : '-'}</td>
                              <td className="py-2.5 text-right font-mono font-semibold text-gray-800">{report.qualitative.management?.roe_5_yr_avg ? `${(report.qualitative.management.roe_5_yr_avg * 100).toFixed(1)}%` : '-'}</td>
                              <td className="py-2.5 text-right font-mono font-semibold text-gray-800">{report.qualitative.management?.roe_10_yr_avg ? `${(report.qualitative.management.roe_10_yr_avg * 100).toFixed(1)}%` : '-'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Board of Directors</h4>
                      <div className="text-sm text-gray-600 bg-gray-50 p-3.5 rounded-xl border border-gray-100 h-full leading-relaxed">
                        {report.qualitative.management?.board_of_directors_summary}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Growth Company Analysis */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-xl font-semibold text-gray-900">AI Growth Company Analysis</h3>
                    {loadingGrowthAnalysis && (
                      <span className="text-xs font-semibold text-blue-600 animate-pulse bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                        Generating AI Insights...
                      </span>
                    )}
                    {growthAnalysis?.generated_at && !loadingGrowthAnalysis && (
                       <span className="text-[10px] text-gray-400">Generated: {new Date(growthAnalysis.generated_at).toLocaleDateString()}</span>
                    )}
                  </div>
                  
                  {loadingGrowthAnalysis ? (
                    <div className="space-y-4 animate-pulse pt-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                      <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  ) : growthAnalysis ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1.5 p-4 rounded-xl border border-gray-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-xl">🔥</span>
                            <span className="font-bold text-gray-800 text-sm">Cash Burn Strategy</span>
                          </div>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
                            growthAnalysis.cash_burn?.verdict === 'Pass' ? 'bg-emerald-100 text-emerald-800' :
                            growthAnalysis.cash_burn?.verdict === 'Warning' ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {growthAnalysis.cash_burn?.verdict || 'N/A'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">{growthAnalysis.cash_burn?.justification || growthAnalysis.cash_burn_analysis}</p>
                      </div>
                      
                      <div className="space-y-1.5 p-4 rounded-xl border border-gray-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-xl">📈</span>
                            <span className="font-bold text-gray-800 text-sm">Margin Trajectory</span>
                          </div>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
                            growthAnalysis.gross_margin?.verdict === 'Pass' ? 'bg-emerald-100 text-emerald-800' :
                            growthAnalysis.gross_margin?.verdict === 'Warning' ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {growthAnalysis.gross_margin?.verdict || 'N/A'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">{growthAnalysis.gross_margin?.justification || growthAnalysis.gross_margin_analysis}</p>
                      </div>

                      <div className="space-y-1.5 p-4 rounded-xl border border-gray-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-xl">🎯</span>
                            <span className="font-bold text-gray-800 text-sm">Path to Profitability</span>
                          </div>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
                            growthAnalysis.profitability_path?.verdict === 'Pass' ? 'bg-emerald-100 text-emerald-800' :
                            growthAnalysis.profitability_path?.verdict === 'Warning' ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {growthAnalysis.profitability_path?.verdict || 'N/A'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">{growthAnalysis.profitability_path?.justification || growthAnalysis.path_to_profitability}</p>
                      </div>

                      <div className="space-y-1.5 p-4 rounded-xl border border-gray-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-xl">⏳</span>
                            <span className="font-bold text-gray-800 text-sm">Runway Analysis</span>
                          </div>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
                            growthAnalysis.runway?.verdict === 'Pass' ? 'bg-emerald-100 text-emerald-800' :
                            growthAnalysis.runway?.verdict === 'Warning' ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {growthAnalysis.runway?.verdict || 'N/A'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">{growthAnalysis.runway?.justification || growthAnalysis.runway_analysis}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic py-2">No growth analysis available.</p>
                  )}
                </div>

                {/* Company Overview */}
                {report.overview && (
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                    <h3 className="text-xl font-semibold text-gray-900 border-b pb-2">Business Overview</h3>
                    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{report.overview}</p>
                  </div>
                )}

                {/* Qualitative Moat */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                  <h3 className="text-xl font-semibold text-gray-900 border-b pb-2">Moat Analysis</h3>
                  {report.qualitative.moats?.moat_types?.map((moat, i) => (
                    <div key={i} className="space-y-1.5 border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-blue-700">{moat.type}</span>
                        <span className="px-2.5 py-0.5 bg-blue-50 text-blue-750 text-[10px] rounded-full font-bold uppercase tracking-wider border border-blue-100">{moat.strength} Moat</span>
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed">{moat.rationale}</p>
                    </div>
                  ))}
                  <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <h4 className="font-semibold text-gray-900 text-sm mb-1">Competitor Comparison</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">{report.qualitative.moats?.competitor_comparison}</p>
                  </div>
                </div>

                {/* Bias Checklist */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                  <h3 className="text-xl font-semibold text-gray-900 border-b pb-2">Confirmation Bias Checklist</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {report.context.market_and_bias?.bias_checklist?.map((item, i) => (
                      <div key={i} className={`p-4 rounded-2xl border ${item.answer ? 'bg-rose-50/50 border-rose-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
                        <div className="flex items-start justify-between">
                          <p className={`font-semibold text-sm ${item.answer ? 'text-rose-900' : 'text-emerald-900'}`}>{item.question}</p>
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${item.answer ? 'bg-rose-200 text-rose-800' : 'bg-emerald-200 text-emerald-800'}`}>
                            {item.answer ? 'YES' : 'NO'}
                          </span>
                        </div>
                        <p className={`mt-2 text-xs leading-relaxed ${item.answer ? 'text-rose-700' : 'text-emerald-700'}`}>{item.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
  );
}
