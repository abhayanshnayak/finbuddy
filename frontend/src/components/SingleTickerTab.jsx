import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Layers, Filter, Calculator } from 'lucide-react';
import TickerSearchInput from './ui/TickerSearchInput';
import CompanyHeader from './ticker/CompanyHeader';
import ExecutiveVerdictStrip from './ticker/ExecutiveVerdictStrip';
import ValuationSuite from './ticker/ValuationSuite';
import Big4MetricsSection from './ticker/Big4MetricsSection';
import AuditTrailDrawer from './ticker/AuditTrailDrawer';
import BusinessModelSection from './ticker/BusinessModelSection';
import CompetitorAnalysisSection from './CompetitorAnalysisSection';
import {
  OverviewAndSentiment,
  StrategyAndRisks,
  ManagementAndHealth,
  GrowthCompanyAnalysisSection,
  MoatAnalysisSection,
  BiasChecklistSection,
} from './ticker/QualitativeSections';
import { useCompanies } from '../context/companiesStore';

const REPORT_SECTIONS = [
  { id: 'section-valuations', label: 'Valuations' },
  { id: 'section-financials', label: 'Big 4 & History' },
  { id: 'section-overview', label: 'Overview' },
  { id: 'section-business-model', label: 'Business Model' },
  { id: 'section-management', label: 'Management' },
  { id: 'section-moat', label: 'Moat & Rivals' },
  { id: 'section-bias', label: 'Bias Checklist' },
];

function hasBusinessModelData(bm) {
  if (!bm || typeof bm !== 'object' || bm.error) return false;
  return Boolean(
    bm.executive_summary ||
      bm.how_it_makes_money?.core_mechanics ||
      (Array.isArray(bm.earnings_divisions) && bm.earnings_divisions.length > 0)
  );
}

function hasGroundedSentimentData(mgmt) {
  if (!mgmt || typeof mgmt !== 'object') return false;
  return Boolean(mgmt.sentiment_generated_at || mgmt.sentiment_grounded);
}

function ReportSkeleton({ symbol }) {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label={`Loading ${symbol} report`}>
      <div className="bg-surface border border-line rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-7 w-16 rounded-md bg-subtle" />
          <div className="h-7 w-64 rounded-md bg-subtle" />
        </div>
        <div className="h-4 w-80 rounded bg-subtle" />
        <p className="text-xs text-ink-muted pt-1">
          Retrieving 10-year financials, SEC XBRL data, valuations, and qualitative analysis for{' '}
          <strong className="font-mono text-ink">{symbol}</strong>...
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="bg-surface border border-line rounded-xl p-4 h-32 space-y-3">
            <div className="h-3 w-24 bg-subtle rounded" />
            <div className="h-7 w-28 bg-subtle rounded" />
            <div className="h-3 w-40 bg-subtle rounded" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {[1, 2, 3].map((n) => (
          <div key={n} className="bg-surface border border-line rounded-xl p-5 h-80 space-y-4">
            <div className="h-5 w-40 bg-subtle rounded" />
            <div className="h-20 w-full bg-subtle rounded-lg" />
            <div className="h-12 w-full bg-subtle rounded-lg" />
            <div className="h-12 w-full bg-subtle rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SingleTickerTab() {
  const { symbol } = useParams();
  const navigate = useNavigate();
  const { companies, recentTickers, recordRecentTicker, refreshCompanies } = useCompanies();

  const normalizedSymbol = symbol ? decodeURIComponent(symbol).trim().toUpperCase() : '';

  const [reportState, setReportState] = useState({
    symbol: '',
    report: null,
    error: '',
    isFreshFetch: false,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [growthState, setGrowthState] = useState({
    symbol: '',
    data: null,
    loading: false,
  });

  const [businessModelState, setBusinessModelState] = useState({
    symbol: '',
    data: null,
    loading: false,
    error: '',
  });

  const [sentimentState, setSentimentState] = useState({
    symbol: '',
    data: null,
    loading: false,
  });

  const [auditOpen, setAuditOpen] = useState(false);
  const [activeAuditTab, setActiveAuditTab] = useState('growth');

  const fetchGrowthAnalysis = useCallback(async (tickerSym, forceFresh, signal) => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    try {
      const response = await fetch(
        `${apiBase}/api/stocks/${encodeURIComponent(tickerSym)}/growth-analysis?force_fresh=${forceFresh}`,
        { signal }
      );
      if (signal?.aborted) return;
      if (response.ok) {
        const data = await response.json();
        if (!signal?.aborted) {
          setGrowthState({ symbol: tickerSym, data, loading: false });
        }
      } else {
        setGrowthState({ symbol: tickerSym, data: null, loading: false });
      }
    } catch {
      if (!signal?.aborted) {
        setGrowthState({ symbol: tickerSym, data: null, loading: false });
      }
    }
  }, []);

  const fetchBusinessModel = useCallback(async (tickerSym, forceFresh, signal) => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    try {
      const response = await fetch(
        `${apiBase}/api/stocks/${encodeURIComponent(tickerSym)}/business-model?force_fresh=${forceFresh}`,
        { signal }
      );
      if (signal?.aborted) return;
      if (response.ok) {
        const data = await response.json();
        if (!signal?.aborted) {
          setBusinessModelState({
            symbol: tickerSym,
            data,
            loading: false,
            error: '',
          });
        }
      } else {
        let detail = 'Unable to load business model analysis.';
        try {
          const errJson = await response.json();
          if (errJson?.detail) detail = errJson.detail;
        } catch {
          // keep fallback
        }
        if (!signal?.aborted) {
          setBusinessModelState({
            symbol: tickerSym,
            data: null,
            loading: false,
            error: detail,
          });
        }
      }
    } catch {
      if (!signal?.aborted) {
        setBusinessModelState({
          symbol: tickerSym,
          data: null,
          loading: false,
          error: 'Unable to reach business model analysis endpoint.',
        });
      }
    }
  }, []);

  const fetchEmployeeSentiment = useCallback(async (tickerSym, forceFresh, signal) => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    try {
      const response = await fetch(
        `${apiBase}/api/stocks/${encodeURIComponent(tickerSym)}/employee-sentiment?force_fresh=${forceFresh}`,
        { signal }
      );
      if (signal?.aborted) return;
      if (response.ok) {
        const data = await response.json();
        if (!signal?.aborted) {
          setSentimentState({ symbol: tickerSym, data, loading: false });
        }
      } else {
        setSentimentState((prev) => ({
          symbol: tickerSym,
          data: prev.symbol === tickerSym ? prev.data : null,
          loading: false,
        }));
      }
    } catch {
      if (!signal?.aborted) {
        setSentimentState((prev) => ({
          symbol: tickerSym,
          data: prev.symbol === tickerSym ? prev.data : null,
          loading: false,
        }));
      }
    }
  }, []);

  // Load report on route symbol change using AbortController (no synchronous setState inside effect)
  useEffect(() => {
    if (!normalizedSymbol) return undefined;

    const controller = new AbortController();
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    fetch(`${apiBase}/api/report/${encodeURIComponent(normalizedSymbol)}?force_fresh=false`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          let detail = 'Failed to fetch report or invalid ticker symbol.';
          try {
            const errJson = await response.json();
            if (errJson?.detail) detail = errJson.detail;
          } catch {
            // keep fallback message
          }
          throw new Error(detail);
        }
        return response.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const resolvedSym = data.ticker || normalizedSymbol;
        setReportState({
          symbol: normalizedSymbol,
          report: data,
          error: '',
          isFreshFetch: false,
        });
        recordRecentTicker(resolvedSym, data.name || resolvedSym);
        setGrowthState({ symbol: resolvedSym, data: null, loading: true });
        fetchGrowthAnalysis(resolvedSym, false, controller.signal);

        const embeddedBusinessModel = data.qualitative?.business_model;
        if (hasBusinessModelData(embeddedBusinessModel)) {
          setBusinessModelState({
            symbol: resolvedSym,
            data: embeddedBusinessModel,
            loading: false,
            error: '',
          });
        } else {
          setBusinessModelState({ symbol: resolvedSym, data: null, loading: true, error: '' });
          fetchBusinessModel(resolvedSym, false, controller.signal);
        }

        if (hasGroundedSentimentData(data.qualitative?.management)) {
          setSentimentState({ symbol: resolvedSym, data: null, loading: false });
        } else {
          setSentimentState({ symbol: resolvedSym, data: null, loading: true });
          fetchEmployeeSentiment(resolvedSym, false, controller.signal);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setReportState({
          symbol: normalizedSymbol,
          report: null,
          error: err.message || 'Unable to load equity report.',
          isFreshFetch: false,
        });
      });

    return () => controller.abort();
  }, [
    normalizedSymbol,
    fetchGrowthAnalysis,
    fetchBusinessModel,
    fetchEmployeeSentiment,
    recordRecentTicker,
  ]);

  // Explicit user-triggered Force Fresh Refresh (does not run on checkbox toggle)
  const handleForceRefresh = useCallback(async () => {
    if (!normalizedSymbol) return;
    setIsRefreshing(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(
        `${apiBase}/api/report/${encodeURIComponent(normalizedSymbol)}?force_fresh=true`
      );
      if (!response.ok) {
        let detail = 'Failed to refresh report.';
        try {
          const errJson = await response.json();
          if (errJson?.detail) detail = errJson.detail;
        } catch {
          // keep fallback
        }
        throw new Error(detail);
      }
      const data = await response.json();
      const resolvedSym = data.ticker || normalizedSymbol;
      setReportState({
        symbol: normalizedSymbol,
        report: data,
        error: '',
        isFreshFetch: true,
      });
      recordRecentTicker(resolvedSym, data.name || resolvedSym);
      refreshCompanies();

      const embeddedBusinessModel = data.qualitative?.business_model;
      const followUps = [];

      setGrowthState({ symbol: resolvedSym, data: null, loading: true });
      followUps.push(fetchGrowthAnalysis(resolvedSym, true));

      if (hasBusinessModelData(embeddedBusinessModel)) {
        setBusinessModelState({
          symbol: resolvedSym,
          data: embeddedBusinessModel,
          loading: false,
          error: '',
        });
      } else {
        setBusinessModelState({ symbol: resolvedSym, data: null, loading: true, error: '' });
        followUps.push(fetchBusinessModel(resolvedSym, true));
      }

      if (hasGroundedSentimentData(data.qualitative?.management)) {
        setSentimentState({ symbol: resolvedSym, data: null, loading: false });
      } else {
        setSentimentState({ symbol: resolvedSym, data: null, loading: true });
        followUps.push(fetchEmployeeSentiment(resolvedSym, true));
      }

      await Promise.all(followUps);
    } catch (err) {
      setReportState((prev) => ({
        ...prev,
        error: err.message || 'Unable to refresh equity report.',
      }));
    } finally {
      setIsRefreshing(false);
    }
  }, [
    normalizedSymbol,
    fetchGrowthAnalysis,
    fetchBusinessModel,
    fetchEmployeeSentiment,
    recordRecentTicker,
    refreshCompanies,
  ]);

  const isCurrentSymbolLoaded = reportState.symbol === normalizedSymbol;
  const loading = Boolean(normalizedSymbol) && !isCurrentSymbolLoaded;
  const report = isCurrentSymbolLoaded ? reportState.report : null;
  const error = isCurrentSymbolLoaded ? reportState.error : '';
  const isFreshFetch = isCurrentSymbolLoaded ? reportState.isFreshFetch : false;

  const activeResolvedSym = report?.ticker || normalizedSymbol;
  const growthAnalysis = growthState.symbol === activeResolvedSym ? growthState.data : null;
  const loadingGrowthAnalysis =
    Boolean(report) && growthState.symbol === activeResolvedSym && growthState.loading;

  const businessModel =
    businessModelState.symbol === activeResolvedSym
      ? businessModelState.data
      : hasBusinessModelData(report?.qualitative?.business_model)
        ? report.qualitative.business_model
        : null;
  const loadingBusinessModel =
    Boolean(report) && businessModelState.symbol === activeResolvedSym && businessModelState.loading;
  const businessModelError =
    businessModelState.symbol === activeResolvedSym ? businessModelState.error : '';

  const handleRefreshBusinessModel = useCallback(() => {
    if (!activeResolvedSym) return;
    setBusinessModelState({ symbol: activeResolvedSym, data: null, loading: true, error: '' });
    fetchBusinessModel(activeResolvedSym, true);
  }, [activeResolvedSym, fetchBusinessModel]);

  const employeeSentiment =
    sentimentState.symbol === activeResolvedSym ? sentimentState.data : null;
  const loadingSentiment =
    Boolean(report) && sentimentState.symbol === activeResolvedSym && sentimentState.loading;

  const handleRefreshSentiment = useCallback(() => {
    if (!activeResolvedSym) return;
    setSentimentState((prev) => ({
      symbol: activeResolvedSym,
      data: prev.symbol === activeResolvedSym ? prev.data : null,
      loading: true,
    }));
    fetchEmployeeSentiment(activeResolvedSym, true);
  }, [activeResolvedSym, fetchEmployeeSentiment]);

  // Dynamic document title
  useEffect(() => {
    if (report?.ticker) {
      document.title = `${report.ticker} · ${report.name} — StockClue`;
    } else if (normalizedSymbol) {
      document.title = `${normalizedSymbol} — StockClue`;
    } else {
      document.title = 'Ticker Research — StockClue';
    }
  }, [report, normalizedSymbol]);

  const handleSelectTicker = (sym) => {
    navigate(`/ticker/${encodeURIComponent(sym)}`);
  };

  const handleOpenAudit = (tab = 'growth') => {
    setActiveAuditTab(tab);
    setAuditOpen(true);
  };

  const scrollToSection = (sectionId) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Empty state when visiting /ticker directly with no symbol
  if (!normalizedSymbol) {
    const quickPickList =
      recentTickers.length > 0
        ? recentTickers.slice(0, 6)
        : companies.slice(0, 6).map((c) => ({ ticker: c.ticker, name: c.name }));

    return (
      <div className="max-w-3xl mx-auto py-8 space-y-6 animate-fadeIn">
        <div className="bg-surface border border-line rounded-xl p-6 sm:p-8 space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-ink tracking-tight">
              Single Ticker Equity Research
            </h1>
            <p className="text-sm text-ink-secondary mt-1">
              Enter any US ticker symbol or pick an indexed company to open its full 4-M valuation
              and SEC filings dossier.
            </p>
          </div>

          <TickerSearchInput onSelectTicker={handleSelectTicker} autoFocus size="lg" />

          {quickPickList.length > 0 && (
            <div className="pt-2 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                {recentTickers.length > 0 ? 'Recently Viewed' : 'Indexed Coverage'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {quickPickList.map((item) => (
                  <button
                    key={item.ticker}
                    type="button"
                    onClick={() => handleSelectTicker(item.ticker)}
                    className="p-3 rounded-lg bg-subtle/60 hover:bg-brand-soft border border-line hover:border-brand/40 text-left transition-colors cursor-pointer"
                  >
                    <span className="font-mono font-bold text-sm text-brand block">
                      {item.ticker}
                    </span>
                    <span className="text-xs text-ink-secondary truncate block mt-0.5">
                      {item.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-line flex flex-wrap gap-4 text-xs">
            <Link
              to="/screener"
              className="inline-flex items-center gap-1.5 text-ink-secondary hover:text-brand font-medium"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Browse by tags in Screener</span>
            </Link>
            <Link
              to="/ingest"
              className="inline-flex items-center gap-1.5 text-ink-secondary hover:text-brand font-medium"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Batch ingest up to 500 tickers</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Compact inline lookup bar for fast ticker switching */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink transition-colors w-max cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <div className="w-full sm:max-w-md">
          <TickerSearchInput
            key={normalizedSymbol}
            initialValue={normalizedSymbol}
            onSelectTicker={handleSelectTicker}
            placeholder="Switch ticker symbol..."
            size="md"
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div
          role="alert"
          className="bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 rounded-xl p-4 flex items-start gap-3 text-sm"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">Unable to load analysis for {normalizedSymbol}</p>
            <p className="text-xs opacity-90">{error}</p>
          </div>
        </div>
      )}

      {/* Structured Skeleton Loader */}
      {loading && <ReportSkeleton symbol={normalizedSymbol} />}

      {/* Loaded Report */}
      {report && !loading && (
        <div className="space-y-6">
          {/* 1. Company Identity & Controls Header */}
          <CompanyHeader
            report={report}
            growthAnalysis={growthAnalysis}
            businessModel={businessModel}
            isFreshFetch={isFreshFetch}
            isRefreshing={isRefreshing}
            onForceRefresh={handleForceRefresh}
            onOpenAudit={handleOpenAudit}
          />

          {/* 2. Executive 4-M Verdict Strip & Valuation Price Ladder */}
          <ExecutiveVerdictStrip report={report} />

          {/* 3. Sticky Section Jump Nav */}
          <nav
            aria-label="Report sections"
            className="sticky top-14 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 py-2.5 bg-canvas/90 backdrop-blur-md border-y border-line flex items-center justify-between gap-3 overflow-x-auto no-print"
          >
            <div className="flex items-center gap-1.5">
              {REPORT_SECTIONS.map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => scrollToSection(sec.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-ink-secondary hover:text-brand hover:bg-surface border border-transparent hover:border-line whitespace-nowrap transition-colors cursor-pointer"
                >
                  {sec.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => handleOpenAudit('growth')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-brand bg-brand-soft border border-brand/20 whitespace-nowrap cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Full Math Audit</span>
            </button>
          </nav>

          {/* 4. Valuation Suite + What-If Workbench */}
          <ValuationSuite key={report.ticker} report={report} onOpenAudit={handleOpenAudit} />

          {/* 5. Big 4 Core Growth + 10-Year Historical Bar Chart */}
          <Big4MetricsSection report={report} />

          {/* 6. Business Overview, Gurus & Primary Sources */}
          <OverviewAndSentiment report={report} />

          {/* 6.5 Business Model, Unit Economics & Earnings Divisions */}
          <BusinessModelSection
            key={report.ticker}
            companyName={report.name}
            businessModel={businessModel}
            loading={loadingBusinessModel}
            error={businessModelError}
            onRefresh={handleRefreshBusinessModel}
          />

          {/* 7. Strategy & Risks */}
          <StrategyAndRisks report={report} />

          {/* 8. Management Quality, Debt & ROIC/ROE Chart */}
          <ManagementAndHealth
            report={report}
            employeeSentiment={employeeSentiment}
            loadingSentiment={loadingSentiment}
            onRefreshSentiment={handleRefreshSentiment}
          />

          {/* 9. AI Growth Company Analysis */}
          <GrowthCompanyAnalysisSection
            growthAnalysis={growthAnalysis}
            loading={loadingGrowthAnalysis}
          />

          {/* 10. Moat Breakdown */}
          <MoatAnalysisSection report={report} />

          {/* 11. Competitive Landscape & 2×2 Market Structure Matrix */}
          <CompetitorAnalysisSection
            key={report.ticker}
            companyName={report.name}
            competitors={report.qualitative?.competitors}
            legacyComparison={report.qualitative?.moats?.competitor_comparison}
          />

          {/* 12. Confirmation Bias Checklist (Corrected Polarity) */}
          <BiasChecklistSection report={report} />

          {/* Slide-Over Calculation Transparency & Audit Drawer */}
          <AuditTrailDrawer
            open={auditOpen}
            activeTab={activeAuditTab}
            onTabChange={setActiveAuditTab}
            onClose={() => setAuditOpen(false)}
            report={report}
          />
        </div>
      )}
    </div>
  );
}
