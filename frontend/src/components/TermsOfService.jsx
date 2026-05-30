import React from 'react';

function TermsOfService() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 bg-slate-50">
        <h2 className="text-xl font-bold text-slate-800">Terms of Service & Disclaimer</h2>
      </div>
      <div className="p-6 space-y-6 text-slate-700 leading-relaxed">
        <p className="font-semibold text-red-600">
          PLEASE READ THIS DISCLAIMER CAREFULLY BEFORE USING FINBUDDY.
        </p>

        <div>
          <h3 className="font-bold text-lg mb-2">1. No Financial Advice</h3>
          <p>
            The information, analysis, and data provided by Finbuddy (the "Service") are for informational and educational purposes only. Nothing contained on this Service constitutes financial, investment, legal, or tax advice. You should not make any financial or investment decisions based on the AI-generated reports or financial metrics displayed here.
          </p>
        </div>

        <div>
          <h3 className="font-bold text-lg mb-2">2. No Guarantee of Accuracy</h3>
          <p>
            The financial numbers, stock metrics, and AI-generated insights are heavily automated and rely on third-party APIs and large language models. <strong className="text-slate-900">There is absolutely no guarantee that the numbers are correct, accurate, complete, or up-to-date.</strong> The Service may produce hallucinations, parse numbers incorrectly, or display outdated data. You are solely responsible for independently verifying all data and information before taking any action.
          </p>
        </div>

        <div>
          <h3 className="font-bold text-lg mb-2">3. Limitation of Liability</h3>
          <p>
            Under no circumstances shall the author, contributors, or providers of this Service be liable for any direct, indirect, incidental, consequential, special, or exemplary damages, including but not limited to financial losses, lost profits, or data loss arising out of or in connection with your use of the Service. 
            <strong className="text-slate-900 block mt-2">
              YOU USE THIS SERVICE ENTIRELY AT YOUR OWN RISK.
            </strong>
          </p>
        </div>

        <div>
          <h3 className="font-bold text-lg mb-2">4. As-Is Availability</h3>
          <p>
            The Service is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, whether express or implied.
          </p>
        </div>
      </div>
    </div>
  );
}

export default TermsOfService;
