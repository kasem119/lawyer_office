import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ConnectionProvider } from './contexts/ConnectionContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout/Layout';
import ServerConnect from './components/Auth/ServerConnect';
import Login from './components/Auth/Login';
import LoadingSpinner from './components/Shared/LoadingSpinner';

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

function MainContent() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [serverConnectOpen, setServerConnectOpen] = useState(false);

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
    return <Login onChangeServer={() => setServerConnectOpen(true)} />;
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
    <ThemeProvider>
      <ConnectionProvider>
        <AuthProvider>
          <NotificationProvider>
            <MainContent />
          </NotificationProvider>
        </AuthProvider>
      </ConnectionProvider>
    </ThemeProvider>
  );
}
