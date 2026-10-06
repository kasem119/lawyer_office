import React from 'react';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Calendar,
  Menu,
  Crown,
  UserCog,
  Activity
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function BottomNav({ activeTab, onSelectTab, onOpenDrawer }) {
  const { isSuperAdmin } = useAuth();

  const isCasesActive = activeTab === 'cases' || activeTab === 'case_details';
  const isClientsActive = activeTab === 'clients' || activeTab === 'client_details';
  const isCalendarActive = activeTab === 'calendar' || activeTab === 'tasks';
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
      },
      {
        id: 'menu',
        label: 'المزيد',
        icon: Menu,
        isActive: activeTab !== 'platform_admin' && activeTab !== 'users' && activeTab !== 'activity_log',
        onClick: onOpenDrawer
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
      },
      {
        id: 'menu',
        label: 'المزيد',
        icon: Menu,
        isActive: !isDashboardActive && !isCasesActive && !isClientsActive && !isCalendarActive,
        onClick: onOpenDrawer
      }
    ];
  }

  return (
    <nav
      className="mobile-bottom-nav hide-on-desktop"
      aria-label="التنقل السريع في الهاتف"
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
            >
              <div className="mobile-nav-icon-wrapper">
                <Icon
                  size={item.isActive ? 25 : 23}
                  strokeWidth={item.isActive ? 2.3 : 1.9}
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
