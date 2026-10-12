import React from 'react';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  FileText,
  FileSignature,
  Calendar,
  CheckSquare,
  ShieldAlert,
  UserCog,
  Database,
  Scale,
  Receipt,
  BarChart3,
  Activity,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  CreditCard,
  Crown,
  User,
  X,
  LogOut,
  Server,
  Sun,
  Moon,
  Laptop
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getServerUrl } from '../../api/client';

export default function Sidebar({ activeTab, setActiveTab, collapsed = false, setCollapsed, onClose, onChangeServer }) {
  const { user, tenant, isAdmin, isSuperAdmin, logout } = useAuth();
  const { theme, cycleTheme } = useTheme();

  let navGroups = [];

  if (isSuperAdmin) {
    navGroups = [
      {
        title: 'الإدارة المركزية (SaaS)',
        items: [
          { id: 'platform_admin', label: 'إدارة المشتركين والمكاتب', icon: Crown },
          { id: 'users', label: 'إدارة مسؤولي النظام', icon: UserCog },
          { id: 'activity_log', label: 'سجل نشاطات النظام', icon: Activity },
          { id: 'backups', label: 'النسخ الاحتياطي', icon: Database }
        ]
      }
    ];
  } else {
    // Normal Lawyer / Admin navigation
    navGroups = [
      {
        title: 'العمليات والقضايا',
        items: [
          { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
          { id: 'cases', label: 'إدارة القضايا', icon: Briefcase },
          { id: 'clients', label: 'دليل العملاء', icon: Users },
          { id: 'documents', label: 'المستندات والملفات', icon: FileText },
          { id: 'templates', label: 'قوالب المستندات', icon: FileSignature },
        ]
      },
      {
        title: 'المتابعة والمهام',
        items: [
          { id: 'calendar', label: 'التقويم والمواعيد', icon: Calendar },
          { id: 'tasks', label: 'لوحة المهام', icon: CheckSquare },
          { id: 'finance', label: 'المالية والفواتير', icon: Receipt },
          { id: 'reports', label: 'التقارير والإحصائيات', icon: BarChart3 },
          { id: 'conflicts', label: 'فحص تعارض المصالح', icon: ShieldAlert },
          { id: 'portal', label: 'بوابة الموكل الإلكترونية', icon: ShieldCheck },
        ]
      }
    ];

    if (isAdmin) {
      navGroups.push({
        title: 'الإدارة والاشتراك',
        items: [
          { id: 'users', label: 'إدارة المحامين', icon: UserCog },
          { id: 'subscription', label: 'باقة الاشتراك والترقية', icon: CreditCard },
          { id: 'activity_log', label: 'سجل النشاطات والرقابة', icon: Activity },
          { id: 'backups', label: 'النسخ الاحتياطي', icon: Database }
        ]
      });
    }
  }

  // Get user initials
  const getInitials = (name) => {
    if (!name) return 'م';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]} ${parts[1][0]}`;
    return parts[0][0];
  };

  return (
    <aside
      style={{
        width: collapsed ? '78px' : '265px',
        minWidth: collapsed ? '78px' : '265px',
        backgroundColor: 'var(--bg-sidebar)',
        borderLeft: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        padding: collapsed ? '20px 10px' : '20px 14px',
        gap: '16px',
        transition: 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.28s cubic-bezier(0.4, 0, 0.2, 1), padding 0.28s ease',
        userSelect: 'none',
        position: 'relative',
        zIndex: 50,
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}
    >
      {/* Brand Header & Collapse/Close Button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: '0 4px 12px 4px',
          borderBottom: '1px solid var(--border-subtle)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-glow)',
              flexShrink: 0
            }}
          >
            <Scale size={22} color="#ffffff" />
          </div>

          {!collapsed && (
            <div className="animate-fadeIn" style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <h2 style={{ fontSize: '1.02rem', fontWeight: '800', color: 'var(--primary)', lineHeight: '1.2' }}>
                {tenant?.name || 'مكتب المحاماة'}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {tenant?.city || 'طرابلس'}
                </span>
                <span className={`badge ${tenant?.plan === 'trial' ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                  {tenant?.plan === 'trial' ? 'تجريبي' : 'نشط'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Desktop collapse button */}
          {setCollapsed && !collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="hide-on-mobile"
              title="طي القائمة الجانبية"
              style={{
                background: 'var(--primary-light)',
                border: '1px solid var(--border-color)',
                color: 'var(--primary)',
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.18s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--primary)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--primary-light)';
                e.currentTarget.style.color = 'var(--primary)';
              }}
            >
              <ChevronRight size={18} />
            </button>
          )}

          {/* Mobile drawer close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="hide-on-desktop"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title="إغلاق القائمة"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Expand Button when collapsed (desktop) */}
      {setCollapsed && collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="hide-on-mobile"
          title="توسيع القائمة الجانبية"
          style={{
            background: 'var(--primary-light)',
            border: '1px solid var(--border-color)',
            color: 'var(--primary)',
            width: '100%',
            padding: '8px 0',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.18s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--primary)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--primary-light)';
            e.currentTarget.style.color = 'var(--primary)';
          }}
        >
          <ChevronLeft size={18} />
        </button>
      )}

      {/* User Mini Profile in Sidebar */}
      <div
        className="glass-card"
        style={{
          padding: collapsed ? '10px 6px' : '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          justifyContent: collapsed ? 'center' : 'flex-start'
        }}
        title={`${user?.name || 'مستخدم'} (${isAdmin ? 'مدير المكتب' : 'محامي'})`}
      >
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: 'var(--primary-light)',
            border: '1px solid var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary)',
            fontWeight: '700',
            fontSize: '0.82rem',
            flexShrink: 0
          }}
        >
          {getInitials(user?.name)}
        </div>

        {!collapsed && (
          <div className="animate-fadeIn" style={{ overflow: 'hidden', flex: 1 }}>
            <div
              style={{
                fontSize: '0.88rem',
                fontWeight: '700',
                color: 'var(--text-main)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {user?.name || 'المحامي'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <span
                className={`badge ${isSuperAdmin ? 'badge-info' : isAdmin ? 'badge-urgent' : 'badge-active'}`}
                style={{ fontSize: '0.68rem', padding: '1px 6px', background: isSuperAdmin ? 'var(--primary)' : undefined, color: isSuperAdmin ? '#fff' : undefined }}
              >
                {(isAdmin || isSuperAdmin) ? <ShieldCheck size={11} /> : null}
                {isSuperAdmin ? 'مالك المنظومة' : isAdmin ? 'مدير المكتب' : 'محامي'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Groups */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {!collapsed && (
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  color: 'var(--text-dim)',
                  padding: '4px 10px',
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase'
                }}
              >
                {group.title}
              </div>
            )}

            {collapsed && groupIdx > 0 && (
              <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '4px 8px' }} />
            )}

            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (onClose) onClose();
                  }}
                  title={collapsed ? item.label : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: '12px',
                    padding: collapsed ? '11px 0' : '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: isActive ? 'var(--primary-light)' : 'transparent',
                    color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                    fontWeight: isActive ? '700' : '500',
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    textAlign: 'right',
                    position: 'relative',
                    borderRight: isActive ? '3px solid var(--primary)' : '3px solid transparent'
                  }}
                  onMouseOver={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                      e.currentTarget.style.color = 'var(--text-main)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }
                  }}
                >
                  <Icon
                    size={20}
                    color={isActive ? 'var(--primary)' : 'var(--text-muted)'}
                    style={{ flexShrink: 0 }}
                  />
                  {!collapsed && (
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Mobile Drawer Footer: Server info, Theme toggle, Logout */}
      <div
        className="hide-on-desktop"
        style={{
          marginTop: 'auto',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        {/* Server connection settings are only shown in local and desktop installs. */}
        {onChangeServer && <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-card)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.78rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
            <Server size={14} color="var(--primary)" />
            <span style={{ color: 'var(--text-muted)' }}>الخادم:</span>
            <span style={{ color: 'var(--text-main)', direction: 'ltr', fontWeight: '600', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {getServerUrl()}
            </span>
          </div>
          {onChangeServer && (
            <button
              onClick={() => {
                if (onClose) onClose();
                onChangeServer();
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                fontSize: '0.76rem',
                fontWeight: '700',
                textDecoration: 'underline'
              }}
            >
              تغيير
            </button>
          )}
        </div>}

        {/* Theme toggle & Logout row */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={cycleTheme}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              padding: '9px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            {theme === 'light' ? <Sun size={15} color="var(--primary)" /> : theme === 'auto' ? <Laptop size={15} color="var(--primary)" /> : <Moon size={15} color="var(--primary)" />}
            <span>{theme === 'light' ? 'فاتح' : theme === 'auto' ? 'تلقائي' : 'داكن'}</span>
          </button>

          <button
            onClick={() => {
              if (onClose) onClose();
              logout();
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: 'var(--error-light)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: 'var(--error)',
              padding: '9px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            <LogOut size={15} />
            <span>خروج</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
