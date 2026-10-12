import React, { lazy, Suspense, useState, useEffect } from 'react';
import { Crown, LogOut } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ConnectionProvider } from './contexts/ConnectionContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import LoadingSpinner from './components/Shared/LoadingSpinner';
import ErrorBoundary from './components/Shared/ErrorBoundary';

// Keep these declarations outside render so React caches each loaded screen.
const Layout = lazy(() => import('./components/Layout/Layout'));
const ServerConnect = lazy(() => import('./components/Auth/ServerConnect'));
const Login = lazy(() => import('./components/Auth/Login'));
const Register = lazy(() => import('./components/Auth/Register'));
const Landing = lazy(() => import('./components/Landing/Landing'));
const Dashboard = lazy(() => import('./components/Dashboard/Dashboard'));
const CaseList = lazy(() => import('./components/Cases/CaseList'));
const CaseDetails = lazy(() => import('./components/Cases/CaseDetails'));
const ClientList = lazy(() => import('./components/Clients/ClientList'));
const ClientDetails = lazy(() => import('./components/Clients/ClientDetails'));
const DocumentList = lazy(() => import('./components/Documents/DocumentList'));
const TemplateList = lazy(() => import('./components/Templates/TemplateList'));
const Calendar = lazy(() => import('./components/Calendar/Calendar'));
const TaskBoard = lazy(() => import('./components/Tasks/TaskBoard'));
const ConflictAlert = lazy(() => import('./components/Conflicts/ConflictAlert'));
const UserManagement = lazy(() => import('./components/Auth/UserManagement'));
const BackupManager = lazy(() => import('./components/Backups/BackupManager'));
const FinancePage = lazy(() => import('./components/Finance/FinancePage'));
const ReportsPage = lazy(() => import('./components/Reports/ReportsPage'));
const LawyerPerformance = lazy(() => import('./components/Reports/LawyerPerformance'));
const ActivityLog = lazy(() => import('./components/ActivityLog/ActivityLog'));
const ClientPortalModal = lazy(() => import('./components/Portal/ClientPortalModal'));
const SubscriptionPage = lazy(() => import('./components/Subscription/SubscriptionPage'));
const PlatformAdmin = lazy(() => import('./components/PlatformAdmin/PlatformAdmin'));

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
        <Suspense fallback={<LoadingSpinner text="جاري تحميل لوحة المنصة..." />}>
          <PlatformAdmin />
        </Suspense>
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
  const isHostedWebApp = typeof window !== 'undefined' &&
    window.location?.protocol?.startsWith('http') &&
    !['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  const canConfigureServer = isDesktopApp || !isHostedWebApp;
  
  const getInitialAuthMode = () => {
    if (isDesktopApp) return 'login';
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash === '#login') return 'login';
      if (hash === '#register') return 'register';
      if (hash === '#portal') return 'portal';
    }
    return 'landing';
  };

  const [authMode, setAuthMode] = useState(getInitialAuthMode);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#login') setAuthMode('login');
      else if (hash === '#register') setAuthMode('register');
      else if (hash === '#portal') setAuthMode('portal');
      else setAuthMode('landing');
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

  if (authMode === 'portal') {
    return <ClientPortalModal isOpen={true} onClose={() => {
      window.location.hash = '';
      setAuthMode('landing');
    }} />;
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
          onChangeServer={canConfigureServer ? () => setServerConnectOpen(true) : undefined}
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
      onChangeServer={canConfigureServer ? () => setServerConnectOpen(true) : undefined}
      onNavigate={handleNavigate}
    >
      <Suspense key={activeTab} fallback={<LoadingSpinner text="جاري تحميل الصفحة..." />}>
        {renderTabContent()}
      </Suspense>
    </Layout>
  );
}

function SessionContent() {
  const { user } = useAuth();
  // Drop navigation and selected records whenever the authenticated account changes.
  return <MainContent key={user ? `${user.tenant_id}:${user.id}` : 'guest'} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ConnectionProvider>
          <AuthProvider>
            <NotificationProvider>
              <Suspense fallback={<LoadingSpinner fullScreen size="lg" withIcon text="جاري تحميل الواجهة..." />}>
                <SessionContent />
              </Suspense>
            </NotificationProvider>
          </AuthProvider>
        </ConnectionProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
