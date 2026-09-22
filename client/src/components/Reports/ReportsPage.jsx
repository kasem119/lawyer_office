import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import LawyerPerformance from './LawyerPerformance';
import { Briefcase, Users, CheckSquare, Calendar, TrendingUp, DollarSign, Wallet, CreditCard, Award } from 'lucide-react';

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [financialData, setFinancialData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [caseTypes, setCaseTypes] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [overviewRes, typesRes, finRes] = await Promise.all([
        apiFetch('/reports/overview'),
        apiFetch('/reports/case-types'),
        apiFetch('/reports/financial-summary')
      ]);
      
      if (overviewRes.ok) {
        const overviewJson = await overviewRes.json();
        setData(overviewJson.data);
      }
      if (typesRes.ok) {
        const typesJson = await typesRes.json();
        setCaseTypes(typesJson.data || []);
      }
      if (finRes.ok) {
        const finJson = await finRes.json();
        setFinancialData(finJson.data || null);
      }
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', color: 'var(--text-muted)', textAlign: 'center' }}>جاري تحميل التقارير...</div>;
  if (error) return <div style={{ padding: '20px', color: 'var(--error)' }}>{error}</div>;
  if (!data) return null;

  const totalCases = (data.cases || []).reduce((sum, item) => sum + item.count, 0);
  const activeCases = (data.cases || []).find(c => c.status === 'active')?.count || 0;
  const pendingTasks = (data.tasks || []).find(t => t.status === 'todo' || t.status === 'in_progress')?.count || 0;

  const maxMonthRev = Math.max(...(financialData?.revenue_by_month?.map(m => Number(m.revenue)) || [1]), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--primary)' }}>لوحة التقارير والإحصائيات</h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>مؤشرات الأداء الشاملة والمالية لجميع أعمال المكتب</p>
        </div>
      </div>
      
      {/* General Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '18px' }}>
        <StatCard icon={<Briefcase size={22} />} title="إجمالي القضايا" value={totalCases} color="var(--primary)" />
        <StatCard icon={<TrendingUp size={22} />} title="قضايا نشطة" value={activeCases} color="var(--success)" />
        <StatCard icon={<Users size={22} />} title="إجمالي العملاء" value={data.total_clients || 0} color="var(--info)" />
        <StatCard icon={<CheckSquare size={22} />} title="مهام جارية" value={pendingTasks} color="var(--warning)" />
        <StatCard icon={<Calendar size={22} />} title="أحداث الأسبوع" value={data.upcoming_events?.next_7_days || 0} color="var(--error)" />
      </div>

      {/* Financial Summary Section */}
      {financialData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
            المؤشرات المالية وصافي الأرباح
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px' }}>
            <StatCard 
              icon={<DollarSign size={22} />} 
              title="إجمالي الأتعاب المحصلة" 
              value={`${(Number(financialData.total_paid) || 0).toLocaleString()} د.ل`} 
              color="var(--success)" 
            />
            <StatCard 
              icon={<CreditCard size={22} />} 
              title="مبالغ قيد التحصيل" 
              value={`${(Number(financialData.total_pending) || 0).toLocaleString()} د.ل`} 
              color="var(--warning)" 
            />
            <StatCard 
              icon={<Wallet size={22} />} 
              title="إجمالي المصروفات" 
              value={`${(Number(financialData.total_expenses) || 0).toLocaleString()} د.ل`} 
              color="var(--error)" 
            />
            <StatCard 
              icon={<Award size={22} />} 
              title="صافي الأرباح" 
              value={`${(Number(financialData.net_profit) || 0).toLocaleString()} د.ل`} 
              color="var(--primary)" 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
            {/* Monthly Revenue Trend */}
            <div className="glass-card" style={{ padding: '20px' }}>
              <h3 style={{ color: 'var(--primary)', marginBottom: '16px', fontSize: '1.1rem', fontWeight: '700' }}>
                نمو الإيرادات الشهرية المحصلة (آخر 6 أشهر)
              </h3>
              {(!financialData.revenue_by_month || financialData.revenue_by_month.length === 0) ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>لا توجد إيرادات مسجلة في الأشهر الماضية</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {financialData.revenue_by_month.map((item, idx) => {
                    const pct = Math.round((Number(item.revenue) / maxMonthRev) * 100);
                    return (
                      <div key={idx}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{item.month}</span>
                          <span style={{ fontWeight: '700', color: 'var(--success)' }}>{Number(item.revenue).toLocaleString()} د.ل</span>
                        </div>
                        <div style={{ width: '100%', height: '10px', backgroundColor: 'var(--bg-progress)', borderRadius: '5px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', backgroundColor: 'var(--success)', borderRadius: '5px' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Cases by Revenue */}
            <div className="glass-card" style={{ padding: '20px' }}>
              <h3 style={{ color: 'var(--primary)', marginBottom: '16px', fontSize: '1.1rem', fontWeight: '700' }}>
                أعلى القضايا دخلاً للمكتب
              </h3>
              {(!financialData.top_cases_by_revenue || financialData.top_cases_by_revenue.length === 0) ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>لا توجد دفعات مكتملة مرتبطة بقضايا</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {financialData.top_cases_by_revenue.map((c, i) => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-item)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                      <div>
                        <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.9rem' }}>{c.title}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{c.case_number}</div>
                      </div>
                      <span className="badge badge-active" style={{ fontSize: '0.85rem' }}>
                        {Number(c.total_revenue).toLocaleString()} د.ل
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Case Status Breakdown */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ color: 'var(--primary)', marginBottom: '16px', fontSize: '1.1rem', fontWeight: '700' }}>حالات القضايا</h3>
          {(data.cases || []).map(stat => (
            <div key={stat.status} style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)', marginBottom: '6px', fontSize: '0.9rem' }}>
                <span>{getStatusLabel(stat.status)}</span>
                <span style={{ fontWeight: '700' }}>{stat.count}</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-progress)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${totalCases > 0 ? (stat.count / totalCases) * 100 : 0}%`, height: '100%', backgroundColor: 'var(--primary)', borderRadius: '4px' }}></div>
              </div>
            </div>
          ))}
          {(data.cases || []).length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>لا توجد قضايا مسجلة</p>}
        </div>

        {/* Case Types Breakdown */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ color: 'var(--primary)', marginBottom: '16px', fontSize: '1.1rem', fontWeight: '700' }}>توزيع القضايا حسب النوع</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {caseTypes.map(type => (
              <div key={type.case_type || 'unspecified'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-item)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>{type.case_type || 'غير مصنف'}</span>
                <span className="badge badge-active">{type.count} قضية</span>
              </div>
            ))}
            {caseTypes.length === 0 && <span style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>لا توجد بيانات</span>}
          </div>
        </div>
      </div>

      {/* Lawyer Performance */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 style={{ color: 'var(--primary)', marginBottom: '16px', fontSize: '1.1rem', fontWeight: '700' }}>معدلات أداء وإنجاز المحامين</h3>
        <LawyerPerformance />
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, color }) {
  return (
    <div className="glass-card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ backgroundColor: `${color}20`, color: color, padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2px' }}>{title}</div>
        <div style={{ color: 'var(--text-main)', fontSize: '1.5rem', fontWeight: '800' }}>{value}</div>
      </div>
    </div>
  );
}

function getStatusLabel(status) {
  const map = {
    'active': 'قيد النظر (نشطة)',
    'pending': 'معلقة',
    'closed': 'مغلقة ومحكومة',
    'archived': 'مؤرشفة'
  };
  return map[status] || status;
}
