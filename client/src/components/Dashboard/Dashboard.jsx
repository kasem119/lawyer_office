import React, { useState, useEffect } from 'react';
import { Briefcase, Clock, CheckSquare, Users, Plus, Calendar as CalendarIcon, FileText, Receipt, FileSignature } from 'lucide-react';
import StatCard from './StatCard';
import DashboardCharts from './DashboardCharts';
import Button from '../Shared/Button';
import { apiFetch } from '../../api/client';

export default function Dashboard({ setActiveTab }) {
  const [stats, setStats] = useState({
    totalCases: 0,
    activeCases: 0,
    upcomingEvents: 0,
    pendingTasks: 0,
    uncollectedCount: 0,
    uncollectedAmount: 0
  });
  const [allCases, setAllCases] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [allInvoices, setAllInvoices] = useState([]);
  const [recentCases, setRecentCases] = useState([]);
  const [recentTasks, setRecentTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [casesRes, eventsRes, tasksRes, invoicesRes] = await Promise.all([
          apiFetch('/cases'),
          apiFetch('/events'),
          apiFetch('/tasks'),
          apiFetch('/invoices')
        ]);

        const casesData = casesRes.ok ? await casesRes.json() : { cases: [] };
        const eventsData = eventsRes.ok ? await eventsRes.json() : { events: [] };
        const tasksData = tasksRes.ok ? await tasksRes.json() : { tasks: [] };
        const invoicesData = invoicesRes.ok ? await invoicesRes.json() : { data: [] };

        const cases = casesData.cases || [];
        const events = eventsData.events || [];
        const tasks = tasksData.tasks || [];
        const invoices = invoicesData.data || [];

        setAllCases(cases);
        setAllTasks(tasks);
        setAllInvoices(invoices);

        const uncollected = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled');
        const uncollectedAmount = uncollected.reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0);

        setStats({
          totalCases: cases.length,
          activeCases: cases.filter(c => c.status === 'active').length,
          upcomingEvents: events.filter(e => new Date(e.date) >= new Date()).length,
          pendingTasks: tasks.filter(t => t.status !== 'done').length,
          uncollectedCount: uncollected.length,
          uncollectedAmount
        });

        setRecentCases(cases.slice(0, 5));
        setRecentTasks(tasks.filter(t => t.status !== 'done').slice(0, 5));
      } catch (err) {
        console.error('Dashboard data fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--primary)' }}>نظرة عامة على المكتب</h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>مرحباً بك، إليك ملخص القضايا والمهام الجارية اليوم</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Button icon={Plus} onClick={() => setActiveTab('cases')}>قضية جديدة</Button>
          <Button icon={Plus} variant="secondary" onClick={() => setActiveTab('clients')}>عميل جديد</Button>
          <Button icon={Receipt} variant="secondary" onClick={() => setActiveTab('finance')}>المالية والفواتير</Button>
          <Button icon={FileSignature} variant="secondary" onClick={() => setActiveTab('templates')}>قوالب العقود</Button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div onClick={() => setActiveTab('cases')} style={{ cursor: 'pointer' }}>
          <StatCard title="إجمالي القضايا" value={stats.totalCases} icon={Briefcase} color="var(--primary)" subtitle="جميع الملفات المسجلة" />
        </div>
        <div onClick={() => setActiveTab('cases')} style={{ cursor: 'pointer' }}>
          <StatCard title="القضايا المنظورة" value={stats.activeCases} icon={Clock} color="var(--success)" subtitle="قيد التداول والمرافعة" />
        </div>
        <div onClick={() => setActiveTab('calendar')} style={{ cursor: 'pointer' }}>
          <StatCard title="المواعيد والجلسات" value={stats.upcomingEvents} icon={CalendarIcon} color="var(--warning)" subtitle="خلال الفترة القادمة" />
        </div>
        <div onClick={() => setActiveTab('tasks')} style={{ cursor: 'pointer' }}>
          <StatCard title="المهام المطلوبة" value={stats.pendingTasks} icon={CheckSquare} color="var(--info)" subtitle="بانتظار التنفيذ" />
        </div>
        <div onClick={() => setActiveTab('finance')} style={{ cursor: 'pointer' }}>
          <StatCard
            title="الأتعاب غير المحصلة"
            value={`${stats.uncollectedAmount.toLocaleString()} د.ل`}
            icon={Receipt}
            color="#ec4899"
            subtitle={`${stats.uncollectedCount} فواتير بانتظار السداد`}
          />
        </div>
      </div>

      {/* Interactive Charts: Case Breakdown, Task Progress, Collection Rates */}
      <DashboardCharts 
        cases={allCases}
        tasks={allTasks}
        invoices={allInvoices}
        setActiveTab={setActiveTab}
      />

      {/* Grid: Recent Cases & Pending Tasks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {/* Recent Cases */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Briefcase size={20} />
              أحدث القضايا المنظورة
            </h3>
            <button onClick={() => setActiveTab('cases')} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem' }}>
              عرض الكل ←
            </button>
          </div>

          {recentCases.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '20px', textAlign: 'center' }}>لا توجد قضايا مضافة حديثاً</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentCases.map((c) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-item)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{c.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      رقم القضية: <span style={{ direction: 'ltr', display: 'inline-block' }}>{c.case_number}</span> | العميل: {c.client_name}
                    </div>
                  </div>
                  <span className={`badge badge-${c.status}`}>
                    {c.status === 'active' ? 'نشطة' : c.status === 'pending' ? 'معلقة' : 'مغلقة'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Tasks */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckSquare size={20} />
              المهام العاجلة
            </h3>
            <button onClick={() => setActiveTab('tasks')} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem' }}>
              عرض المهام ←
            </button>
          </div>

          {recentTasks.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '20px', textAlign: 'center' }}>لا توجد مهام معلقة</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentTasks.map((t) => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-item)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{t.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      المكلف: {t.assigned_to_name} | الاستحقاق: {t.due_date || 'غير محدد'}
                    </div>
                  </div>
                  <span className={`badge badge-${t.priority}`}>
                    {t.priority === 'urgent' ? 'عاجل' : t.priority === 'high' ? 'عالي' : 'عادي'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
