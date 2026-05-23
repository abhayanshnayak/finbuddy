import { useState } from 'react';
import Header from './components/Header';
import SingleTickerTab from './components/SingleTickerTab';
import BulkIngestionTab from './components/BulkIngestionTab';

function App() {
  const [activeTab, setActiveTab] = useState('single');
  const [targetTicker, setTargetTicker] = useState('');

  const handleViewTicker = (ticker) => {
    setTargetTicker(ticker);
    setActiveTab('single');
  };

  return (
    <div className="min-h-screen p-8 bg-slate-50">
      <div className="max-w-5xl mx-auto space-y-8">
        <Header activeTab={activeTab} setActiveTab={setActiveTab} />
        {activeTab === 'single' && <SingleTickerTab initialTicker={targetTicker} />}
        {activeTab === 'bulk' && <BulkIngestionTab onViewTicker={handleViewTicker} />}
      </div>
    </div>
  );
}

export default App;
