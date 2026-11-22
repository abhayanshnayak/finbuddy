import { useEffect } from 'react';
import { ShieldAlert, FileText } from 'lucide-react';

export default function TermsOfService() {
  useEffect(() => {
    document.title = 'Terms of Service & Disclaimer — StockClue';
  }, []);

  return (
    <article className="max-w-3xl mx-auto bg-surface rounded-xl border border-line overflow-hidden animate-fadeIn">
      <div className="px-6 py-5 border-b border-line bg-subtle/50 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-soft text-brand flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink">Terms of Service &amp; Disclaimer</h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Legal disclosures governing the use of StockClue research and automated analytics
          </p>
        </div>
      </div>

      <div className="p-6 space-y-6 text-sm text-ink-secondary leading-relaxed">
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-start gap-3">
          <ShieldAlert
            className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <p className="font-semibold text-rose-700 dark:text-rose-300 text-xs leading-relaxed">
            PLEASE READ THIS DISCLAIMER CAREFULLY BEFORE USING STOCKCLUE. All financial valuations,
            SEC XBRL derivations, and AI-generated narratives are strictly informational.
          </p>
        </div>

        <section className="space-y-1.5">
          <h2 className="font-bold text-base text-ink">1. No Financial Advice</h2>
          <p>
            The information, analysis, and data provided by StockClue (the &ldquo;Service&rdquo;)
            are for informational and educational purposes only. Nothing contained on this Service
            constitutes financial, investment, legal, or tax advice. You should not make any
            financial or investment decisions based on the AI-generated reports or financial metrics
            displayed here.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-bold text-base text-ink">2. No Guarantee of Accuracy</h2>
          <p>
            The financial numbers, stock metrics, and AI-generated insights are heavily automated
            and rely on third-party APIs and large language models.{' '}
            <strong className="text-ink">
              There is absolutely no guarantee that the numbers are correct, accurate, complete, or
              up-to-date.
            </strong>{' '}
            The Service may produce hallucinations, parse numbers incorrectly, or display outdated
            data. You are solely responsible for independently verifying all data and information
            before taking any action.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-bold text-base text-ink">3. Limitation of Liability</h2>
          <p>
            Under no circumstances shall the author, contributors, or providers of this Service be
            liable for any direct, indirect, incidental, consequential, special, or exemplary
            damages, including but not limited to financial losses, lost profits, or data loss
            arising out of or in connection with your use of the Service.
          </p>
          <p className="font-bold text-ink pt-1">YOU USE THIS SERVICE ENTIRELY AT YOUR OWN RISK.</p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-bold text-base text-ink">4. As-Is Availability</h2>
          <p>
            The Service is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis
            without warranties of any kind, whether express or implied.
          </p>
        </section>
      </div>
    </article>
  );
}
