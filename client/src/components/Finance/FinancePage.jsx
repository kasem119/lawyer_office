import React, { useState } from 'react';
import InvoiceList from './InvoiceList';
import ExpenseTracker from './ExpenseTracker';
import TimeTracker from './TimeTracker';
import { FileText, Receipt, Clock } from 'lucide-react';

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState('invoices');

  const tabs = [
    { id: 'invoices', label: 'الفواتير والمستحقات', icon: FileText },
    { id: 'expenses', label: 'المصروفات والرسوم', icon: Receipt },
    { id: 'time', label: 'ساعات العمل وتتبع الوقت', icon: Clock }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--primary)' }}>الإدارة المالية والأتعاب</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>إدارة الفواتير، المصروفات، وساعات عمل المحامين المسجلة</p>
      </div>

      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '8px'
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: isActive ? 'var(--primary-light)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                border: 'none',
                borderBottom: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                padding: '10px 18px',
                borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: isActive ? '700' : '500',
                fontSize: '0.95rem',
                transition: 'all 0.2s ease'
              }}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div>
        {activeTab === 'invoices' && <InvoiceList />}
        {activeTab === 'expenses' && <ExpenseTracker />}
        {activeTab === 'time' && <TimeTracker />}
      </div>
    </div>
  );
}
