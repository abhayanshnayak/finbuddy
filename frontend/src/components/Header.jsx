import React from 'react';

export default function Header({ activeTab, setActiveTab }) {
  return (
        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-blue-500/20">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Finbuddy</h1>
          </div>
          <p className="text-gray-500 font-medium">Enterprise Stock Ingestion & Value Investing Dashboard</p>
          
          {/* Main Navigation Tabs */}
          <div className="bg-gray-100/80 p-1.5 rounded-2xl flex space-x-1 shadow-inner border border-gray-200 mt-4 backdrop-blur-sm">
            <button
              onClick={() => setActiveTab('single')}
              className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                activeTab === 'single'
                  ? 'bg-white text-blue-600 shadow-md transform scale-[1.02]'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50/50'
              }`}
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Single Ticker Analysis</span>
            </button>
            
            <button
              onClick={() => setActiveTab('bulk')}
              className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                activeTab === 'bulk'
                  ? 'bg-white text-blue-600 shadow-md transform scale-[1.02]'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50/50'
              }`}
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Bulk Ingestion Hub</span>
            </button>
          </div>
        </div>
  );
}
