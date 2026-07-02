import React, { useState, useRef, useEffect } from 'react';

const NAV_ITEMS = [
  {
    key: 'single',
    label: 'Single Ticker Analysis',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    heroIcon: (
      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    description: 'Deep-dive analysis on a single stock',
    gradient: 'from-blue-500 to-indigo-600',
    shadow: 'shadow-blue-500/20',
  },
  {
    key: 'bulk',
    label: 'Bulk Ingestion Hub',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
    heroIcon: (
      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
    description: 'Ingest multiple tickers at once',
    gradient: 'from-emerald-500 to-teal-600',
    shadow: 'shadow-emerald-500/20',
  },
  {
    key: 'tags',
    label: 'Tag Search Workspace',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    heroIcon: (
      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    description: 'Search and compare by tags',
    gradient: 'from-amber-500 to-orange-600',
    shadow: 'shadow-amber-500/20',
  },
];

export default function Header({ activeTab, setActiveTab }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const isLanding = activeTab === 'landing';

  // ─── Landing Hero ───
  if (isLanding) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6 animate-fadeIn">
        {/* Logo + Title */}
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-blue-500/20">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Finbuddy</h1>
        </div>
        <p className="text-gray-500 font-medium">Enterprise Stock Ingestion & Value Investing Dashboard</p>

        {/* Hero Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 w-full max-w-2xl">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className="group flex flex-col items-center p-6 rounded-2xl bg-white border border-gray-200 
                         hover:border-transparent hover:shadow-xl hover:shadow-gray-200/50 
                         transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              <div className={`bg-gradient-to-tr ${item.gradient} p-3 rounded-xl shadow-lg ${item.shadow} 
                              mb-3 transition-transform duration-300 group-hover:scale-110`}>
                {item.heroIcon}
              </div>
              <span className="text-sm font-semibold text-gray-800">{item.label}</span>
              <span className="text-xs text-gray-400 mt-1 text-center">{item.description}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Compact Top Bar (shown on active tab pages) ───
  const activeItem = NAV_ITEMS.find((i) => i.key === activeTab);

  return (
    <div className="flex items-center justify-between py-3 animate-fadeIn relative z-40">
      {/* Left: Logo + active page name */}
      <div className="flex items-center space-x-3 w-auto lg:w-1/4">
        <button
          onClick={() => setActiveTab('landing')}
          className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-1.5 rounded-xl shadow-md shadow-blue-500/15 
                     hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 cursor-pointer flex-shrink-0"
          title="Back to home"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </button>
        <div className="hidden sm:flex items-center space-x-2 whitespace-nowrap">
          <span className="text-lg font-bold text-gray-900 tracking-tight">Finbuddy</span>
          {activeItem && (
            <>
              <span className="text-gray-300">/</span>
              <span className="text-sm font-medium text-gray-500">{activeItem.label}</span>
            </>
          )}
        </div>
      </div>

      {/* Center: Search Portal Target */}
      <div id="header-center-portal" className="flex-1 flex justify-center px-2 sm:px-4" />

      {/* Right: Hamburger menu */}
      <div className="relative flex justify-end w-auto lg:w-1/4" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={`p-2 rounded-xl transition-all duration-200 cursor-pointer flex-shrink-0
                     ${menuOpen 
                       ? 'bg-gray-200 text-gray-700' 
                       : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}
          title="Navigation"
        >
          {menuOpen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl shadow-gray-200/60 border border-gray-100 
                          py-1.5 z-50 animate-menuSlideIn">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setActiveTab(item.key);
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 text-sm transition-colors duration-150 cursor-pointer
                           ${activeTab === item.key
                             ? 'bg-blue-50 text-blue-600 font-semibold'
                             : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
