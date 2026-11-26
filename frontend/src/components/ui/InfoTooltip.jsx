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
    const margin = 12;
    const popWidth = Math.min(320, window.innerWidth - margin * 2);

    let left = rect.left + rect.width / 2 - popWidth / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - popWidth - margin));

    // Apply width before opening so measured height reflects exact line wrapping
    popEl.style.width = `${popWidth}px`;
    popEl.style.left = `${left}px`;
    popEl.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - margin)}px`;

    if (typeof popEl.showPopover === 'function') {
      popEl.showPopover();
    }

    const popRect = popEl.getBoundingClientRect();
    const popHeight = popRect.height || 200;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;

    let top;
    if (spaceBelow >= popHeight + 8) {
      top = rect.bottom + 8;
    } else if (spaceAbove >= popHeight + 8) {
      top = rect.top - popHeight - 8;
    } else {
      top = Math.max(margin, window.innerHeight - popHeight - margin);
    }

    popEl.style.top = `${top}px`;
    setCoords({ top, left, width: popWidth });
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
          width: `${coords.width || 320}px`,
        }}
        className="sc-popover rounded-xl bg-surface text-ink border border-line-strong shadow-xl p-4 text-left whitespace-normal normal-case tracking-normal font-normal break-words animate-menuSlideIn"
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-xs font-bold text-ink leading-snug">{resolvedTitle}</p>
          <button
            type="button"
            onClick={() => popoverRef.current?.hidePopover?.()}
            aria-label="Close explanation"
            className="text-ink-muted hover:text-ink p-0.5 rounded transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {resolvedSummary && (
          <p className="text-xs text-ink-secondary leading-relaxed whitespace-normal break-words">
            {resolvedSummary}
          </p>
        )}

        {resolvedFormula && (
          <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-subtle border border-line">
            <span className="text-[11px] font-semibold text-ink-muted block mb-0.5">Formula</span>
            <code className="block text-[11px] font-mono text-ink whitespace-normal break-words leading-relaxed">
              {resolvedFormula}
            </code>
          </div>
        )}

        {resolvedBenchmark && (
          <p className="mt-2 text-[11px] font-medium text-brand leading-snug whitespace-normal break-words">
            Benchmark: {resolvedBenchmark}
          </p>
        )}
      </div>
    </span>
  );
}
