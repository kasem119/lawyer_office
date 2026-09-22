import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import OfflineBanner from './OfflineBanner';

export default function Layout({ activeTab, setActiveTab, onChangeServer, onNavigate, children }) {
  // Collapse state stored in localStorage
  const [collapsed, setCollapsedState] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const setCollapsed = (val) => {
    setCollapsedState(val);
    localStorage.setItem('sidebar_collapsed', val ? 'true' : 'false');
  };

  // Close mobile menu on tab change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [activeTab]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-dark)'
      }}
    >
      <OfflineBanner />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Sidebar Overlay on Mobile */}
        {mobileMenuOpen && (
          <div 
            onClick={() => setMobileMenuOpen(false)}
            className="hide-on-desktop animate-fadeIn"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 49
            }}
          />
        )}

        {/* Sidebar */}
        <div className={`sidebar-container ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
          />
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <Header
            onChangeServer={onChangeServer}
            onToggleMobileSidebar={() => setMobileMenuOpen(prev => !prev)}
            onNavigate={onNavigate}
          />

          <main
            key={activeTab}
            className="animate-fadeIn"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px',
              backgroundColor: 'var(--bg-dark)'
            }}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

