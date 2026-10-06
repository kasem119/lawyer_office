import React, { useState } from 'react';
import { User, LogOut, Server, ShieldCheck, Sun, Moon, Laptop, Menu, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getServerUrl } from '../../api/client';
import NotificationBell from '../Notifications/NotificationBell';
import GlobalSearch from '../Shared/GlobalSearch';
import UserProfileModal from '../Auth/UserProfileModal';
import AIAssistantModal from '../AI/AIAssistantModal';

export default function Header({ onChangeServer, onToggleMobileSidebar, onNavigate }) {
  const { user, logout, isAdmin, isSuperAdmin } = useAuth();
  const { theme, resolvedTheme, cycleTheme, setTheme } = useTheme();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);

  const getThemeIcon = () => {
    if (theme === 'auto') return <Laptop size={17} color="var(--primary)" />;
    if (theme === 'light') return <Sun size={17} color="var(--primary)" />;
    return <Moon size={17} color="var(--primary)" />;
  };

  const getThemeLabel = () => {
    if (theme === 'auto') return 'تلقائي (النظام)';
    if (theme === 'light') return 'الوضع الفاتح';
    return 'الوضع الداكن';
  };

  return (
    <header
      className="app-header"
      style={{
        backgroundColor: 'var(--bg-header)',
        backdropFilter: 'var(--backdrop-blur)',
        WebkitBackdropFilter: 'var(--backdrop-blur)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 'max(10px, env(safe-area-inset-top, 0px))',
        paddingBottom: '10px',
        paddingLeft: '14px',
        paddingRight: '14px',
        minHeight: 'calc(58px + env(safe-area-inset-top, 0px))',
        gap: '10px',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      {/* Right side: Mobile Menu Button & Brand / Server info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        {onToggleMobileSidebar && (
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            className="hide-on-desktop"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
            title="القائمة الرئيسية"
          >
            <Menu size={20} />
          </button>
        )}

        <div className="hide-on-desktop" style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '0.98rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          منظومة المحاماة
        </div>

        <div
          className="hide-on-mobile"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-card)',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-color)',
            fontSize: '0.82rem',
            transition: 'all 0.2s ease'
          }}
        >
          <Server size={14} color="var(--primary)" />
          <span style={{ color: 'var(--text-muted)' }}>الخادم:</span>
          <span
            style={{
              color: 'var(--text-main)',
              fontWeight: '600',
              direction: 'ltr',
              maxWidth: '180px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {getServerUrl()}
          </span>
          <button
            onClick={onChangeServer}
            title="تغيير عنوان الخادم"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: '700',
              marginRight: '4px',
              textDecoration: 'underline'
            }}
          >
            تغيير
          </button>
        </div>
      </div>

      {/* Center: Global Search (Desktop inline / Mobile trigger) */}
      <div style={{ flex: 1, maxWidth: '420px', display: 'flex', justifyContent: 'center' }}>
        {!isSuperAdmin && <GlobalSearch onNavigate={onNavigate} />}
      </div>

      {/* Left side: Theme Switcher, Notifications & User Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {/* Theme Cycle Button (Desktop) */}
        <button
          type="button"
          onClick={cycleTheme}
          className="hide-on-mobile"
          title={`الوضع الحالي: ${getThemeLabel()} - اضغط للتبديل (داكن / فاتح / تلقائي)`}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            padding: '7px 12px',
            borderRadius: 'var(--radius-full)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.82rem',
            fontWeight: '600',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary)';
            e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {getThemeIcon()}
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {theme === 'auto' ? 'تلقائي' : theme === 'light' ? 'فاتح' : 'داكن'}
          </span>
        </button>

        {/* AI Legal Assistant Button */}
        {!isSuperAdmin && (
          <button
            type="button"
            onClick={() => setIsAIOpen(true)}
            title="المساعد القانوني الذكي وصياغة العقود"
            style={{
              background: 'linear-gradient(135deg, rgba(212, 168, 83, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)',
              border: '1px solid var(--border-color)',
              padding: '7px 12px',
              borderRadius: 'var(--radius-full)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              fontWeight: '700',
              color: 'var(--primary)',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Sparkles size={16} />
            <span className="hide-on-mobile">المساعد الذكي</span>
          </button>
        )}

        {/* Notifications */}
        <NotificationBell />

        {/* User Info & Logout */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <div
            onClick={() => setIsProfileOpen(true)}
            title="الملف الشخصي وتغيير كلمة المرور"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: 'var(--radius-md)',
              transition: 'background 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-light)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--primary-light)',
                border: '1px solid var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                flexShrink: 0
              }}
            >
              <User size={18} />
            </div>

            <div className="hide-on-mobile" style={{ textAlign: 'right' }}>
              <div
                style={{
                  fontSize: '0.9rem',
                  fontWeight: '700',
                  color: 'var(--text-main)',
                  maxWidth: '120px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {user?.name || 'مستخدم'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span
                  className={`badge ${isSuperAdmin ? 'badge-info' : isAdmin ? 'badge-urgent' : 'badge-active'}`}
                  style={{ fontSize: '0.68rem', padding: '1px 6px', background: isSuperAdmin ? 'var(--primary)' : undefined, color: isSuperAdmin ? '#fff' : undefined }}
                >
                  {(isAdmin || isSuperAdmin) ? <ShieldCheck size={11} /> : null}
                  {isSuperAdmin ? 'مالك المنظومة' : isAdmin ? 'مدير المكتب' : 'محامي'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="hide-on-mobile"
            title="تسجيل الخروج من المنظومة"
            style={{
              background: 'var(--error-light)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: 'var(--error)',
              borderRadius: 'var(--radius-sm)',
              padding: '7px 9px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.18s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--error)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--error-light)';
              e.currentTarget.style.color = 'var(--error)';
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {isProfileOpen && (
        <UserProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      )}

      {isAIOpen && (
        <AIAssistantModal isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
      )}
    </header>
  );
}

