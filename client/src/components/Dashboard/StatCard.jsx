import React from 'react';

export default function StatCard({ title, value, icon: Icon, color = 'var(--primary)', subtitle }) {
  return (
    <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '6px' }}>{title}</div>
        <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-main)' }}>{value}</div>
        {subtitle && <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>{subtitle}</div>}
      </div>
      <div style={{
        width: '50px',
        height: '50px',
        borderRadius: '12px',
        background: color === 'var(--primary)' ? 'var(--primary-light)' :
                    color === 'var(--success)' ? 'rgba(16, 185, 129, 0.14)' :
                    color === 'var(--warning)' ? 'rgba(245, 158, 11, 0.14)' :
                    color === 'var(--error)' ? 'rgba(244, 63, 94, 0.14)' : 'rgba(59, 130, 246, 0.14)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={26} color={color} />
      </div>
    </div>
  );
}
