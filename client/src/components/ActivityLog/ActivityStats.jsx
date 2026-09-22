import React from 'react';
import { Activity, Clock, Calendar, TrendingUp } from 'lucide-react';

function StatCard({ icon, title, value, color }) {
  return (
    <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
      <div
        style={{
          backgroundColor: `${color}20`,
          color: color,
          padding: '12px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '2px' }}>{title}</div>
        <div style={{ color: 'var(--text-main)', fontSize: '1.4rem', fontWeight: '800' }}>{value}</div>
      </div>
    </div>
  );
}

export default function ActivityStats({ stats }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
      <StatCard
        icon={<Activity size={22} />}
        title="إجمالي العمليات المسجلة"
        value={stats ? stats.total : '...'}
        color="var(--primary)"
      />
      <StatCard
        icon={<Clock size={22} />}
        title="عمليات اليوم"
        value={stats ? stats.today : '...'}
        color="var(--info)"
      />
      <StatCard
        icon={<Calendar size={22} />}
        title="عمليات هذا الأسبوع"
        value={stats ? stats.thisWeek : '...'}
        color="var(--success)"
      />
      <StatCard
        icon={<TrendingUp size={22} />}
        title="عمليات هذا الشهر"
        value={stats ? stats.thisMonth : '...'}
        color="var(--warning)"
      />
    </div>
  );
}
