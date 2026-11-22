function getQuadrantTheme(quadrant = '') {
  const q = quadrant.toLowerCase();
  if (q.includes('clear moat') && q.includes('growing')) {
    return {
      container: 'bg-emerald-50/70 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/60',
      badge: 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950',
      title: 'text-emerald-900 dark:text-emerald-300',
    };
  }
  if (q.includes('fixed-size') && (q.includes('little moat') || q.includes('weak'))) {
    return {
      container: 'bg-rose-50/70 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/60',
      badge: 'bg-rose-600 text-white dark:bg-rose-500 dark:text-white',
      title: 'text-rose-900 dark:text-rose-300',
    };
  }
  if (q.includes('clear moat')) {
    return {
      container: 'bg-blue-50/70 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/60',
      badge: 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white',
      title: 'text-blue-900 dark:text-blue-300',
    };
  }
  return {
    container: 'bg-amber-50/70 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/60',
    badge: 'bg-amber-600 text-white dark:bg-amber-500 dark:text-slate-950',
    title: 'text-amber-900 dark:text-amber-300',
  };
}

function getThreatBadgeClass(level = '') {
  const normalized = level.toLowerCase();
  if (normalized === 'high') {
    return 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/60';
  }
  if (normalized === 'medium') {
    return 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60';
  }
  if (normalized === 'low') {
    return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60';
  }
  return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600';
}

export default function CompetitorAnalysisSection({ companyName, competitors, legacyComparison }) {
  const verdict = competitors?.market_structure_verdict;
  const competitorList = Array.isArray(competitors?.competitor_list) ? competitors.competitor_list : [];
  const dynamicsSummary = competitors?.competitive_dynamics_summary;
  const sourcesReferenced = Array.isArray(competitors?.sources_referenced) ? competitors.sources_referenced : [];

  const hasVerdict = verdict && (verdict.quadrant || verdict.tam_and_pie_dynamics || verdict.verdict_rationale);
  const hasAnyContent = hasVerdict || competitorList.length > 0 || dynamicsSummary || legacyComparison;

  if (!hasAnyContent) {
    return null;
  }

  const quadrantTheme = getQuadrantTheme(verdict?.quadrant);

  return (
    <section
      aria-labelledby="competitor-analysis-heading"
      className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 dark:border-slate-700 pb-3">
        <div>
          <h3 id="competitor-analysis-heading" className="text-xl font-semibold text-gray-900 dark:text-white">
            Competitive Landscape &amp; Market Structure
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            10-K &amp; market intelligence breakdown — evaluating competitors, moat comparison, and market pie dynamics
          </p>
        </div>
        {competitorList.length > 0 && (
          <span className="inline-flex items-center self-start sm:self-auto px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
            {competitorList.length} Key {competitorList.length === 1 ? 'Competitor' : 'Competitors'}
          </span>
        )}
      </div>

      {/* 1. Market Structure Verdict: Growing Pie + Moat vs Fixed-Size + Little Moat */}
      {hasVerdict && (
        <div className={`p-5 rounded-2xl border space-y-4 ${quadrantTheme.container}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                Market Pie &amp; Moat Verdict
              </span>
              {verdict.quadrant && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold tracking-wide shadow-sm ${quadrantTheme.badge}`}>
                    {verdict.quadrant}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full md:w-auto">
              {verdict.market_growth_outlook && (
                <div className="bg-white/80 dark:bg-slate-800/80 px-3 py-2 rounded-xl border border-gray-200/70 dark:border-slate-700">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block">
                    Market Pie
                  </span>
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    {verdict.market_growth_outlook}
                  </span>
                </div>
              )}
              {verdict.moat_position && (
                <div className="bg-white/80 dark:bg-slate-800/80 px-3 py-2 rounded-xl border border-gray-200/70 dark:border-slate-700">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block">
                    Moat Position
                  </span>
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    {verdict.moat_position}
                  </span>
                </div>
              )}
              {verdict.industry_concentration && (
                <div className="bg-white/80 dark:bg-slate-800/80 px-3 py-2 rounded-xl border border-gray-200/70 dark:border-slate-700">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block">
                    Industry Structure
                  </span>
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    {verdict.industry_concentration}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {verdict.tam_and_pie_dynamics && (
              <div className="bg-white/75 dark:bg-slate-800/75 p-4 rounded-xl border border-gray-200/60 dark:border-slate-700/70 space-y-1.5">
                <h4 className={`text-xs font-bold uppercase tracking-wider ${quadrantTheme.title}`}>
                  TAM &amp; Pie Dynamics
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {verdict.tam_and_pie_dynamics}
                </p>
              </div>
            )}
            {verdict.verdict_rationale && (
              <div className="bg-white/75 dark:bg-slate-800/75 p-4 rounded-xl border border-gray-200/60 dark:border-slate-700/70 space-y-1.5">
                <h4 className={`text-xs font-bold uppercase tracking-wider ${quadrantTheme.title}`}>
                  Strategic Verdict Rationale
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {verdict.verdict_rationale}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Main Competitors Head-to-Head Breakdown */}
      {competitorList.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Main Competitors — Head-to-Head Breakdown
          </h4>

          <div className="space-y-4">
            {competitorList.map((comp, idx) => (
              <article
                key={comp.name || idx}
                className="p-5 rounded-2xl border border-gray-200/80 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30 space-y-4"
              >
                {/* Competitor Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200/70 dark:border-slate-700/70 pb-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold">
                      {idx + 1}
                    </span>
                    <h5 className="text-base font-bold text-gray-900 dark:text-white">
                      {comp.name}
                    </h5>
                    {comp.threat_level && (
                      <span
                        className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${getThreatBadgeClass(comp.threat_level)}`}
                      >
                        {comp.threat_level} Threat
                      </span>
                    )}
                  </div>
                </div>

                {/* Scale & Market Share Callout */}
                {comp.estimated_market_share_and_scale && (
                  <div className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700/80 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                    <span className="font-bold text-gray-900 dark:text-white uppercase tracking-wider text-[10px] mr-2">
                      Scale &amp; Share:
                    </span>
                    {comp.estimated_market_share_and_scale}
                  </div>
                )}

                {/* Scope, Competitive Tactics & Moat Comparison */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {comp.competition_scope && (
                    <div className="space-y-1">
                      <h6 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Overlap &amp; Competition Scope
                      </h6>
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        {comp.competition_scope}
                      </p>
                    </div>
                  )}

                  {comp.how_they_compete && (
                    <div className="space-y-1">
                      <h6 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        How They Compete
                      </h6>
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        {comp.how_they_compete}
                      </p>
                    </div>
                  )}

                  {comp.moat_comparison && (
                    <div className="space-y-1">
                      <h6 className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        Moat Comparison
                      </h6>
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        {comp.moat_comparison}
                      </p>
                    </div>
                  )}
                </div>

                {/* Head-to-Head Edge Comparison */}
                {(comp.target_advantage_over_competitor || comp.key_advantage_over_target) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {comp.target_advantage_over_competitor && (
                      <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-900/15 border border-emerald-100 dark:border-emerald-800/40 space-y-1">
                        <h6 className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                          Where {companyName || 'Company'} Wins
                        </h6>
                        <p className="text-xs text-emerald-900/90 dark:text-emerald-200/90 leading-relaxed">
                          {comp.target_advantage_over_competitor}
                        </p>
                      </div>
                    )}
                    {comp.key_advantage_over_target && (
                      <div className="p-3.5 rounded-xl bg-rose-50/60 dark:bg-rose-900/15 border border-rose-100 dark:border-rose-800/40 space-y-1">
                        <h6 className="text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-400">
                          Where {comp.name} Threatens
                        </h6>
                        <p className="text-xs text-rose-900/90 dark:text-rose-200/90 leading-relaxed">
                          {comp.key_advantage_over_target}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      )}

      {/* 3. Industry Competitive Dynamics & Unit Economics Comparison */}
      {(dynamicsSummary || legacyComparison) && (
        <div className="space-y-4">
          {dynamicsSummary && (
            <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-100 dark:border-slate-600/50 space-y-1.5">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                Industry Dynamics, Barriers to Entry &amp; Margin Durability
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {dynamicsSummary}
              </p>
            </div>
          )}

          {legacyComparison && (
            <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-100 dark:border-slate-600/50 space-y-1.5">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                Peer Unit Economics &amp; Pricing Power Comparison
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {legacyComparison}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 4. 10-K & Source References */}
      {sourcesReferenced.length > 0 && (
        <div className="pt-2 border-t border-gray-100 dark:border-slate-700/70">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
            Sources &amp; Filings Referenced
          </h4>
          <ul className="flex flex-wrap gap-2">
            {sourcesReferenced.map((src, i) => (
              <li
                key={i}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-600/50"
              >
                {src}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
