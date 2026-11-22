import { useId, useRef, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { GLOSSARY } from '../../utils/valuationHelpers';

/**
 * Contextual financial metric explainer using the native HTML Popover API
 * (top-layer stacking, light-dismiss, Escape handling) with dynamic viewport positioning.
 */
export default function InfoTooltip({
  term,
  title,
  summary,
  formula,
  benchmark,
  className = '',
}) {
  const entry = term ? GLOSSARY[term] : null;
  const resolvedTitle = title || entry?.title;
  const resolvedSummary = summary || entry?.summary;
  const resolvedFormula = formula || entry?.formula;
  const resolvedBenchmark = benchmark || entry?.benchmark;

  const popoverId = useId();
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  if (!resolvedTitle && !resolvedSummary) return null;

  const handleToggle = (e) => {
    e.stopPropagation();
    const popEl = popoverRef.current;
    const btnEl = triggerRef.current;
    if (!popEl || !btnEl) return;

    const isOpen = popEl.matches(':popover-open');
    if (isOpen) {
      popEl.hidePopover();
      return;
    }

    const rect = btnEl.getBoundingClientRect();
    const popWidth = 320;
    const margin = 12;
    let left = rect.left + rect.width / 2 - popWidth / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - popWidth - margin));

    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow > 210 ? rect.bottom + 8 : Math.max(margin, rect.top - 196);

    setCoords({ top, left });
    if (typeof popEl.showPopover === 'function') {
      popEl.showPopover();
    }
  };

  return (
    <span className={`inline-flex items-center align-middle no-print ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-label={`Explain ${resolvedTitle}`}
        aria-controls={popoverId}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-ink-muted hover:text-brand hover:bg-subtle transition-colors cursor-pointer"
      >
        <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
      </button>

      <div
        ref={popoverRef}
        id={popoverId}
        popover="auto"
        style={{
          position: 'fixed',
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          width: '320px',
        }}
        className="sc-popover rounded-xl bg-surface text-ink border border-line-strong shadow-xl p-4 text-left animate-menuSlideIn"
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-xs font-bold text-ink leading-snug">{resolvedTitle}</p>
          <button
            type="button"
            onClick={() => popoverRef.current?.hidePopover?.()}
            aria-label="Close explanation"
            className="text-ink-muted hover:text-ink p-0.5 rounded transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {resolvedSummary && (
          <p className="text-xs text-ink-secondary leading-relaxed">{resolvedSummary}</p>
        )}

        {resolvedFormula && (
          <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-subtle border border-line">
            <span className="text-[11px] font-semibold text-ink-muted block mb-0.5">Formula</span>
            <code className="text-[11px] font-mono text-ink break-words">{resolvedFormula}</code>
          </div>
        )}

        {resolvedBenchmark && (
          <p className="mt-2 text-[11px] font-medium text-brand">
            Benchmark: {resolvedBenchmark}
          </p>
        )}
      </div>
    </span>
  );
}
