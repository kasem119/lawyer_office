import React, { useState, useEffect } from 'react';
import { Crown, LogOut } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ConnectionProvider } from './contexts/ConnectionContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout/Layout';
import ServerConnect from './components/Auth/ServerConnect';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Landing from './components/Landing/Landing';
import LoadingSpinner from './components/Shared/LoadingSpinner';
import ErrorBoundary from './components/Shared/ErrorBoundary';

import Dashboard from './components/Dashboard/Dashboard';
import CaseList from './components/Cases/CaseList';
import CaseDetails from './components/Cases/CaseDetails';
import ClientList from './components/Clients/ClientList';
import ClientDetails from './components/Clients/ClientDetails';
import DocumentList from './components/Documents/DocumentList';
import TemplateList from './components/Templates/TemplateList';
import Calendar from './components/Calendar/Calendar';
import TaskBoard from './components/Tasks/TaskBoard';
import ConflictAlert from './components/Conflicts/ConflictAlert';
import UserManagement from './components/Auth/UserManagement';
import BackupManager from './components/Backups/BackupManager';
import FinancePage from './components/Finance/FinancePage';
import ReportsPage from './components/Reports/ReportsPage';
import LawyerPerformance from './components/Reports/LawyerPerformance';
import ActivityLog from './components/ActivityLog/ActivityLog';
import ClientPortalModal from './components/Portal/ClientPortalModal';
import SubscriptionPage from './components/Subscription/SubscriptionPage';
import PlatformAdmin from './components/PlatformAdmin/PlatformAdmin';

function PlatformOwnerScreen() {
  const { user, logout } = useAuth();

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-dark)' }}>
      <header className="app-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', fontWeight: '800' }}>
          <Crown size={22} />
          <span>لوحة مالك المنصة</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>{user?.name}</span>
          <button type="button" onClick={logout} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <LogOut size={16} /> خروج
          </button>
        </div>
      </header>
      <main style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
        <PlatformAdmin />
      </main>
    </div>
  );
}

function MainContent() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [serverConnectOpen, setServerConnectOpen] = useState(false);

  // Default to platform_admin for super_admin
  useEffect(() => {
    if (user && user.role === 'super_admin' && activeTab === 'dashboard') {
      setActiveTab('platform_admin');
    }
  }, [user]);

  // Auth view mode: 'landing', 'login', 'register'
  const isDesktopApp = typeof window !== 'undefined' && (
    window.navigator?.userAgent?.includes('Electron') || 
    window.location?.protocol === 'file:'
  );
  
  const getInitialAuthMode = () => {
    if (isDesktopApp) return 'login';
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash === '#login') return 'login';
      if (hash === '#register') return 'register';
    }
    return 'landing';
  };

  const [authMode, setAuthMode] = useState(getInitialAuthMode);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#login') setAuthMode('login');
      else if (hash === '#register') setAuthMode('register');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (serverConnectOpen) {
    return <ServerConnect onConnected={() => setServerConnectOpen(false)} />;
  }

  if (loading) {
    return (
      <LoadingSpinner
        fullScreen
        size="lg"
        withIcon
        text="جاري تحميل المنظومة والتحقق من الجلسة..."
      />
    );
  }

  if (!user) {
    if (authMode === 'login') {
      return (
        <Login
          onNavigateToRegister={() => {
            window.location.hash = '#register';
            setAuthMode('register');
          }}
          onNavigateToLanding={() => {
            window.location.hash = '';
            setAuthMode('landing');
          }}
          onChangeServer={() => setServerConnectOpen(true)}
        />
      );
    }

    if (authMode === 'register') {
      return (
        <Register
          onNavigateToLogin={() => {
            window.location.hash = '#login';
            setAuthMode('login');
          }}
          onNavigateToLanding={() => {
            window.location.hash = '';
            setAuthMode('landing');
          }}
        />
      );
    }

    // Default unauthenticated view: Marketing Landing Page
    return (
      <Landing
        onNavigateToLogin={() => {
          window.location.hash = '#login';
          setAuthMode('login');
        }}
        onNavigateToRegister={() => {
          window.location.hash = '#register';
          setAuthMode('register');
        }}
      />
    );
  }

  // مالك المنصة له مساحة مستقلة ولا يرث واجهة أو تنقلات مدير المكتب.
  if (user.role === 'super_admin') {
    return <PlatformOwnerScreen />;
  }

  const handleViewCase = (id) => {
    setSelectedCaseId(id);
    setActiveTab('case_details');
  };

  const handleViewClient = (id) => {
    setSelectedClientId(id);
    setActiveTab('client_details');
  };

  const handleNavigate = (tab, id) => {
    if (tab === 'case_details') {
      handleViewCase(id);
    } else if (tab === 'client_details') {
      handleViewClient(id);
    } else {
      setActiveTab(tab);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard setActiveTab={setActiveTab} />;
      case 'cases':
        return <CaseList onViewCase={handleViewCase} />;
      case 'case_details':
        return <CaseDetails caseId={selectedCaseId} onBack={() => setActiveTab('cases')} />;
      case 'clients':
        return <ClientList onViewClient={handleViewClient} />;
      case 'client_details':
        return <ClientDetails clientId={selectedClientId} onBack={() => setActiveTab('clients')} onViewCase={handleViewCase} />;
      case 'documents':
        return <DocumentList />;
      case 'templates':
        return <TemplateList />;
      case 'calendar':
        return <Calendar />;
      case 'tasks':
        return <TaskBoard />;
      case 'conflicts':
        return <ConflictAlert />;
      case 'finance':
        return <FinancePage />;
      case 'reports':
        return <ReportsPage />;
      case 'lawyer_performance':
        return <LawyerPerformance />;
      case 'subscription':
        return <SubscriptionPage />;
      case 'platform_admin':
        return user?.role === 'super_admin' ? <PlatformAdmin /> : <Dashboard setActiveTab={setActiveTab} />;
      case 'users':
        return <UserManagement />;
      case 'activity_log':
        return <ActivityLog />;
      case 'backups':
        return <BackupManager />;
      case 'portal':
        return <ClientPortalModal isOpen={true} onClose={() => setActiveTab('dashboard')} />;
      default:
        return <Dashboard setActiveTab={setActiveTab} />;
    }
  };

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onChangeServer={() => setServerConnectOpen(true)}
      onNavigate={handleNavigate}
    >
      {renderTabContent()}
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ConnectionProvider>
          <AuthProvider>
            <NotificationProvider>
              <MainContent />
            </NotificationProvider>
          </AuthProvider>
        </ConnectionProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
