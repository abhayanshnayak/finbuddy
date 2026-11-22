import { useState } from 'react';
import { ChevronDown, ChevronUp, ShieldAlert, CheckCircle2, Swords } from 'lucide-react';

function resolveQuadrantKey(quadrant = '') {
  const q = quadrant.toLowerCase();
  const hasClearMoat = q.includes('clear moat') || q.includes('wide moat');
  const isGrowing = q.includes('growing') || q.includes('expanding');
  if (hasClearMoat && isGrowing) return 'clear_growing';
  if (hasClearMoat && !isGrowing) return 'clear_fixed';
  if (!hasClearMoat && isGrowing) return 'weak_growing';
  return 'weak_fixed';
}

function getQuadrantTheme(key) {
  switch (key) {
    case 'clear_growing':
      return {
        container: 'bg-emerald-500/5 border-emerald-500/25',
        badge: 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950',
        title: 'text-emerald-700 dark:text-emerald-400',
      };
    case 'clear_fixed':
      return {
        container: 'bg-brand-soft border-brand/25',
        badge: 'bg-brand text-white',
        title: 'text-brand',
      };
    case 'weak_growing':
      return {
        container: 'bg-amber-500/5 border-amber-500/25',
        badge: 'bg-amber-600 text-white dark:bg-amber-500 dark:text-slate-950',
        title: 'text-amber-700 dark:text-amber-400',
      };
    default:
      return {
        container: 'bg-rose-500/5 border-rose-500/25',
        badge: 'bg-rose-600 text-white dark:bg-rose-500 dark:text-white',
        title: 'text-rose-700 dark:text-rose-400',
      };
  }
}

function getThreatBadgeClass(level = '') {
  const normalized = level.toLowerCase();
  if (normalized === 'high') {
    return 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25';
  }
  if (normalized === 'medium') {
    return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25';
  }
  if (normalized === 'low') {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25';
  }
  return 'bg-subtle text-ink-secondary border-line';
}

const MATRIX_CELLS = [
  {
    key: 'clear_fixed',
    title: 'Clear Moat · Mature Pie',
    hint: 'Cash cow / pricing power',
    activeClass: 'bg-brand-soft border-brand text-brand ring-1 ring-brand/40',
  },
  {
    key: 'clear_growing',
    title: 'Clear Moat · Growing Pie',
    hint: 'Ideal compounder',
    activeClass:
      'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/40',
  },
  {
    key: 'weak_fixed',
    title: 'Weak Moat · Fixed Pie',
    hint: 'Zero-sum price war',
    activeClass:
      'bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/40',
  },
  {
    key: 'weak_growing',
    title: 'Weak Moat · Growing Pie',
    hint: 'High churn / execution risk',
    activeClass:
      'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/40',
  },
];

export default function CompetitorAnalysisSection({
  companyName,
  competitors,
  legacyComparison,
}) {
  const verdict = competitors?.market_structure_verdict;
  const competitorList = Array.isArray(competitors?.competitor_list)
    ? competitors.competitor_list
    : [];
  const dynamicsSummary = competitors?.competitive_dynamics_summary;
  const sourcesReferenced = Array.isArray(competitors?.sources_referenced)
    ? competitors.sources_referenced
    : [];

  // Default first 2 (or High-threat) competitors expanded for scannability
  const [expandedMap, setExpandedMap] = useState(() => {
    const init = {};
    competitorList.forEach((comp, idx) => {
      init[idx] = idx < 2 || (comp.threat_level || '').toLowerCase() === 'high';
    });
    return init;
  });

  const hasVerdict =
    verdict &&
    (verdict.quadrant || verdict.tam_and_pie_dynamics || verdict.verdict_rationale);
  const hasAnyContent =
    hasVerdict || competitorList.length > 0 || dynamicsSummary || legacyComparison;

  if (!hasAnyContent) {
    return null;
  }

  const activeQuadrantKey = resolveQuadrantKey(verdict?.quadrant);
  const quadrantTheme = getQuadrantTheme(activeQuadrantKey);

  const toggleItem = (idx) => {
    setExpandedMap((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const allExpanded =
    competitorList.length > 0 && competitorList.every((_, i) => expandedMap[i]);

  const toggleAll = () => {
    const next = {};
    competitorList.forEach((_, i) => {
      next[i] = !allExpanded;
    });
    setExpandedMap(next);
  };

  return (
    <section
      aria-labelledby="competitor-analysis-heading"
      className="bg-surface p-5 sm:p-6 rounded-xl border border-line space-y-6 print-break-avoid"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <h2
            id="competitor-analysis-heading"
            className="text-lg font-bold text-ink flex items-center gap-2"
          >
            <Swords className="w-4 h-4 text-brand" aria-hidden="true" />
            <span>Competitive Landscape &amp; Market Structure</span>
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            10-K &amp; market intelligence breakdown — evaluating rivals, moat durability, and market pie dynamics
          </p>
        </div>
        {competitorList.length > 0 && (
          <span className="inline-flex items-center self-start sm:self-auto px-2.5 py-1 rounded-md text-xs font-semibold bg-subtle text-ink-secondary border border-line">
            {competitorList.length} Key {competitorList.length === 1 ? 'Competitor' : 'Competitors'}
          </span>
        )}
      </div>

      {/* 1. Market Structure Verdict + 2x2 Quadrant Matrix */}
      {hasVerdict && (
        <div className={`p-5 rounded-xl border space-y-5 ${quadrantTheme.container}`}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left: Verdict Badge & 3 Structural Signals */}
            <div className="lg:col-span-7 space-y-4">
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted block">
                  Market Pie &amp; Moat Verdict
                </span>
                {verdict.quadrant && (
                  <span
                    className={`inline-block px-3 py-1 rounded-md text-xs font-bold tracking-wide ${quadrantTheme.badge}`}
                  >
                    {verdict.quadrant}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {verdict.market_growth_outlook && (
                  <div className="bg-surface px-3 py-2.5 rounded-lg border border-line">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted block">
                      Market Pie
                    </span>
                    <span className="text-xs font-semibold text-ink mt-0.5 block">
                      {verdict.market_growth_outlook}
                    </span>
                  </div>
                )}
                {verdict.moat_position && (
                  <div className="bg-surface px-3 py-2.5 rounded-lg border border-line">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted block">
                      Moat Position
                    </span>
                    <span className="text-xs font-semibold text-ink mt-0.5 block">
                      {verdict.moat_position}
                    </span>
                  </div>
                )}
                {verdict.industry_concentration && (
                  <div className="bg-surface px-3 py-2.5 rounded-lg border border-line">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted block">
                      Structure
                    </span>
                    <span className="text-xs font-semibold text-ink mt-0.5 block">
                      {verdict.industry_concentration}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Visual 2x2 Quadrant Matrix */}
            <div className="lg:col-span-5 bg-surface border border-line rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-ink-muted px-1">
                <span>2×2 Strategic Position</span>
                <span>Moat ↑ · Pie →</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {MATRIX_CELLS.map((cell) => {
                  const isActive = cell.key === activeQuadrantKey;
                  return (
                    <div
                      key={cell.key}
                      className={`p-2.5 rounded-lg border transition-colors ${
                        isActive
                          ? cell.activeClass
                          : 'bg-subtle/50 border-line text-ink-muted opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-bold leading-tight">{cell.title}</span>
                        {isActive && (
                          <span className="w-2 h-2 rounded-full bg-current flex-shrink-0" />
                        )}
                      </div>
                      <span className="text-[11px] opacity-80 block mt-0.5">{cell.hint}</span>
                      {isActive && (
                        <span className="mt-1.5 inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface/80 text-ink border border-current/20 truncate max-w-full">
                          {companyName || 'Target'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* TAM & Strategic Verdict Rationale */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {verdict.tam_and_pie_dynamics && (
              <div className="bg-surface p-4 rounded-lg border border-line space-y-1.5">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${quadrantTheme.title}`}>
                  TAM &amp; Pie Dynamics
                </h3>
                <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">
                  {verdict.tam_and_pie_dynamics}
                </p>
              </div>
            )}
            {verdict.verdict_rationale && (
              <div className="bg-surface p-4 rounded-lg border border-line space-y-1.5">
                <h3 className={`text-xs font-bold uppercase tracking-wider ${quadrantTheme.title}`}>
                  Strategic Verdict Rationale
                </h3>
                <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">
                  {verdict.verdict_rationale}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Main Competitors Head-to-Head Breakdown (Collapsible Cards) */}
      {competitorList.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Main Competitors — Head-to-Head Breakdown
            </h3>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-semibold text-brand hover:underline cursor-pointer no-print"
            >
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </button>
          </div>

          <div className="space-y-3">
            {competitorList.map((comp, idx) => {
              const isOpen = Boolean(expandedMap[idx]);
              return (
                <article
                  key={comp.name || idx}
                  className="rounded-xl border border-line bg-subtle/40 overflow-hidden"
                >
                  {/* Competitor Header Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleItem(idx)}
                    aria-expanded={isOpen}
                    className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-subtle/80 transition-colors cursor-pointer"
                  >
                    <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-brand-soft text-brand text-xs font-mono font-bold flex-shrink-0">
                        {idx + 1}
                      </span>
                      <h4 className="text-sm font-bold text-ink">{comp.name}</h4>
                      {comp.threat_level && (
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-md border ${getThreatBadgeClass(
                            comp.threat_level
                          )}`}
                        >
                          {comp.threat_level} Threat
                        </span>
                      )}
                    </div>
                    <span className="text-ink-muted flex-shrink-0 no-print">
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 space-y-4 border-t border-line">
                      {comp.estimated_market_share_and_scale && (
                        <div className="mt-3 px-3.5 py-2.5 rounded-lg bg-surface border border-line text-xs text-ink-secondary leading-relaxed">
                          <span className="font-bold text-ink uppercase tracking-wider mr-2">
                            Scale &amp; Share:
                          </span>
                          {comp.estimated_market_share_and_scale}
                        </div>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {comp.competition_scope && (
                          <div className="space-y-1">
                            <h5 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                              Overlap &amp; Scope
                            </h5>
                            <p className="text-sm text-ink-secondary leading-relaxed">
                              {comp.competition_scope}
                            </p>
                          </div>
                        )}
                        {comp.how_they_compete && (
                          <div className="space-y-1">
                            <h5 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                              Competitive Playbook
                            </h5>
                            <p className="text-sm text-ink-secondary leading-relaxed">
                              {comp.how_they_compete}
                            </p>
                          </div>
                        )}
                        {comp.moat_comparison && (
                          <div className="space-y-1">
                            <h5 className="text-xs font-bold uppercase tracking-wider text-brand">
                              Moat Comparison
                            </h5>
                            <p className="text-sm text-ink-secondary leading-relaxed">
                              {comp.moat_comparison}
                            </p>
                          </div>
                        )}
                      </div>

                      {(comp.target_advantage_over_competitor ||
                        comp.key_advantage_over_target) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                          {comp.target_advantage_over_competitor && (
                            <div className="p-3.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                              <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Where {companyName || 'Company'} Wins</span>
                              </h5>
                              <p className="text-xs text-ink-secondary leading-relaxed">
                                {comp.target_advantage_over_competitor}
                              </p>
                            </div>
                          )}
                          {comp.key_advantage_over_target && (
                            <div className="p-3.5 rounded-lg bg-rose-500/5 border border-rose-500/20 space-y-1">
                              <h5 className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                                <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Where {comp.name} Threatens</span>
                              </h5>
                              <p className="text-xs text-ink-secondary leading-relaxed">
                                {comp.key_advantage_over_target}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Industry Dynamics & Peer Unit Economics */}
      {(dynamicsSummary || legacyComparison) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {dynamicsSummary && (
            <div className="p-4 bg-subtle/50 rounded-xl border border-line space-y-1.5">
              <h3 className="font-bold text-ink text-sm">
                Industry Dynamics, Barriers to Entry &amp; Margin Durability
              </h3>
              <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">
                {dynamicsSummary}
              </p>
            </div>
          )}

          {legacyComparison && (
            <div className="p-4 bg-subtle/50 rounded-xl border border-line space-y-1.5">
              <h3 className="font-bold text-ink text-sm">
                Peer Unit Economics &amp; Pricing Power Comparison
              </h3>
              <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">
                {legacyComparison}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 4. 10-K & Source References */}
      {sourcesReferenced.length > 0 && (
        <div className="pt-3 border-t border-line">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2">
            Sources &amp; Filings Referenced
          </h3>
          <ul className="flex flex-wrap gap-2">
            {sourcesReferenced.map((src, i) => (
              <li
                key={i}
                className="text-xs px-2.5 py-1 rounded-md bg-subtle text-ink-secondary border border-line"
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
