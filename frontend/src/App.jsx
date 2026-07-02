import { useState } from 'react';
import Header from './components/Header';
import SingleTickerTab from './components/SingleTickerTab';
import BulkIngestionTab from './components/BulkIngestionTab';
import TagSearchTab from './components/TagSearchTab';
import TermsOfService from './components/TermsOfService';

function App() {
  const [activeTab, setActiveTab] = useState('landing');
  const [targetTicker, setTargetTicker] = useState('');
  const handleViewTicker = (ticker) => {
    setTargetTicker(ticker);
    setActiveTab('single');
  };

  return (
    <div className="min-h-screen p-8 bg-slate-50 flex flex-col">
      <div className="max-w-5xl mx-auto w-full flex-grow space-y-8">
        <Header activeTab={activeTab} setActiveTab={setActiveTab} />
        {activeTab === 'single' && <SingleTickerTab initialTicker={targetTicker} />}
        {activeTab === 'bulk' && <BulkIngestionTab onViewTicker={handleViewTicker} />}
        {activeTab === 'tags' && <TagSearchTab />}
        {activeTab === 'tos' && <TermsOfService />}
      </div>
      
      <footer className="mt-16 pb-4 text-center text-sm text-slate-400">
        By using Finbuddy, you acknowledge and agree to our{' '}
        <button 
          onClick={() => setActiveTab('tos')} 
          className="text-slate-600 hover:text-slate-900 hover:underline font-medium transition-colors cursor-pointer"
        >
          Terms of Service & Disclaimer
        </button>
        .
      </footer>
    </div>
  );
}

export default App;
