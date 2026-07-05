import { useState, useEffect } from 'react';
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

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <div className="min-h-screen p-8 bg-slate-50 dark:bg-slate-900 flex flex-col transition-colors duration-300">
      <div className="w-full flex-grow space-y-8">
        <Header activeTab={activeTab} setActiveTab={setActiveTab} theme={theme} toggleTheme={toggleTheme} />
        {activeTab === 'single' && <SingleTickerTab initialTicker={targetTicker} />}
        {activeTab === 'bulk' && <BulkIngestionTab onViewTicker={handleViewTicker} />}
        {activeTab === 'tags' && <TagSearchTab />}
        {activeTab === 'tos' && <TermsOfService />}
      </div>
      
      <footer className="mt-16 pb-4 text-center text-sm text-slate-400 dark:text-slate-500">
        By using Finbuddy, you acknowledge and agree to our{' '}
        <button 
          onClick={() => setActiveTab('tos')} 
          className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:underline font-medium transition-colors cursor-pointer"
        >
          Terms of Service & Disclaimer
        </button>
        .
      </footer>
    </div>
  );
}

export default App;
