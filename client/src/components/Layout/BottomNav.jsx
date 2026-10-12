import React from 'react';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Calendar,
  Crown,
  UserCog,
  Activity
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function BottomNav({ activeTab, onSelectTab, onOpenDrawer, drawerOpen = false }) {
  const { isSuperAdmin } = useAuth();

  const isCasesActive = activeTab === 'cases' || activeTab === 'case_details';
  const isClientsActive = activeTab === 'clients' || activeTab === 'client_details';
  const isCalendarActive = activeTab === 'calendar';
  const isDashboardActive = activeTab === 'dashboard';

  let navItems = [];

  if (isSuperAdmin) {
    navItems = [
      {
        id: 'platform_admin',
        label: 'المنصة',
        icon: Crown,
        isActive: activeTab === 'platform_admin',
        onClick: () => onSelectTab('platform_admin')
      },
      {
        id: 'users',
        label: 'المدراء',
        icon: UserCog,
        isActive: activeTab === 'users',
        onClick: () => onSelectTab('users')
      },
      {
        id: 'activity_log',
        label: 'السجل',
        icon: Activity,
        isActive: activeTab === 'activity_log',
        onClick: () => onSelectTab('activity_log')
      }
    ];
  } else {
    navItems = [
      {
        id: 'dashboard',
        label: 'الرئيسية',
        icon: LayoutDashboard,
        isActive: isDashboardActive,
        onClick: () => onSelectTab('dashboard')
      },
      {
        id: 'cases',
        label: 'القضايا',
        icon: Briefcase,
        isActive: isCasesActive,
        onClick: () => onSelectTab('cases')
      },
      {
        id: 'clients',
        label: 'الموكلين',
        icon: Users,
        isActive: isClientsActive,
        onClick: () => onSelectTab('clients')
      },
      {
        id: 'calendar',
        label: 'المواعيد',
        icon: Calendar,
        isActive: isCalendarActive,
        onClick: () => onSelectTab('calendar')
      }
    ];
  }

  return (
    <nav
      className="mobile-bottom-nav hide-on-desktop"
      aria-label="التنقل السريع في الهاتف"
      dir="rtl"
    >
      <div className="mobile-bottom-nav-inner">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`mobile-nav-btn ${item.isActive ? 'active' : ''}`}
              title={item.label}
              aria-current={item.isActive ? 'page' : undefined}
            >
              <div className="mobile-nav-icon-wrapper">
                <Icon
                  size={26}
                  strokeWidth={item.isActive ? 2.5 : 2.2}
                  className={`mobile-nav-icon ${item.isActive ? 'active-icon' : ''}`}
                />
              </div>
              <span className="mobile-nav-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
