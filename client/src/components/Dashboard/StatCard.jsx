import React from 'react';

export default function StatCard({ title, value, icon: Icon, color = 'var(--primary)', subtitle }) {
  return (
    <div className="glass-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', lineHeight: 1.2 }}>{value}</div>
        {subtitle && <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</div>}
      </div>
      <div style={{
        width: '42px',
        height: '42px',
        flexShrink: 0,
        borderRadius: '10px',
        background: color === 'var(--primary)' ? 'var(--primary-light)' :
                    color === 'var(--success)' ? 'rgba(16, 185, 129, 0.14)' :
                    color === 'var(--warning)' ? 'rgba(245, 158, 11, 0.14)' :
                    color === 'var(--error)' ? 'rgba(244, 63, 94, 0.14)' : 'rgba(59, 130, 246, 0.14)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={20} color={color} />
      </div>
    </div>
  );
}
