import React, { useState, useEffect, useRef } from 'react';
import useMediaQuery from '../../hooks/useMediaQuery';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import OfflineBanner from './OfflineBanner';
import UpdateBanner from '../Shared/UpdateBanner';

export default function Layout({ activeTab, setActiveTab, onChangeServer, onNavigate, children }) {
  // Collapse state stored in localStorage
  const [collapsed, setCollapsedState] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!isMobile) setMobileMenuOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!mobileMenuOpen || !isMobile) return;
    const previousFocus = document.activeElement;
    const focusable = () => [...drawerRef.current.querySelectorAll('button, a, input, select, [tabindex="0"]')]
      .filter((element) => !element.disabled && element.getClientRects().length);
    focusable()[0]?.focus();
    const handleKey = (event) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      previousFocus?.focus();
    };
  }, [mobileMenuOpen, isMobile]);

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
      className="app-layout"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        minHeight: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-dark)'
      }}
    >
      <UpdateBanner />
      <OfflineBanner />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Sidebar Overlay on Mobile with backdrop blur */}
        {mobileMenuOpen && (
          <div 
            onClick={() => setMobileMenuOpen(false)}
            className="hide-on-desktop animate-fadeIn"
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              zIndex: 999
            }}
          />
        )}

        {/* Sidebar / Mobile Drawer */}
        <div ref={drawerRef} id="mobile-navigation" role={isMobile && mobileMenuOpen ? 'dialog' : undefined} aria-modal={isMobile && mobileMenuOpen ? true : undefined} aria-label="القائمة الرئيسية" className={`sidebar-container ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <Sidebar
            activeTab={activeTab}
            setActiveTab={(tab) => {
              setActiveTab(tab);
              setMobileMenuOpen(false);
            }}
            collapsed={isMobile ? false : collapsed}
            setCollapsed={setCollapsed}
            onClose={() => setMobileMenuOpen(false)}
            onChangeServer={onChangeServer}
          />
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <Header
            onChangeServer={onChangeServer}
            onToggleMobileSidebar={() => setMobileMenuOpen(prev => !prev)}
            onNavigate={onNavigate}
            mobileMenuOpen={mobileMenuOpen}
          />

          <main
            key={activeTab}
            className="app-main animate-fadeIn"
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

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        drawerOpen={mobileMenuOpen}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setMobileMenuOpen(false);
        }}
        onOpenDrawer={() => setMobileMenuOpen(true)}
      />
    </div>
  );
}

