import React from 'react';
import { PieChart, TrendingUp, DollarSign, CheckCircle2 } from 'lucide-react';

export default function DashboardCharts({ cases = [], tasks = [], invoices = [], setActiveTab }) {
  // Case stats
  const totalCases = cases.length || 1;
  const activeCases = cases.filter(c => c.status === 'active').length;
  const pendingCases = cases.filter(c => c.status === 'pending').length;
  const closedCases = cases.filter(c => c.status === 'closed').length;

  const activePct = Math.round((activeCases / totalCases) * 100);
  const pendingPct = Math.round((pendingCases / totalCases) * 100);
  const closedPct = Math.round((closedCases / totalCases) * 100);

  // Task stats
  const totalTasks = tasks.length || 1;
  const doneTasks = tasks.filter(t => t.status === 'done').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
  const todoTasks = tasks.filter(t => t.status === 'todo').length;
  const donePct = Math.round((doneTasks / totalTasks) * 100);

  // Invoice stats
  const totalInvoiced = invoices.reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0) || 1;
  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const paidAmount = paidInvoices.reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0);
  const pendingAmount = invoices
    .filter(i => i.status === 'sent' || i.status === 'overdue' || i.status === 'draft')
    .reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0);
  const collectionRate = Math.round((paidAmount / totalInvoiced) * 100);

  const hasData = cases.length > 0 || tasks.length > 0 || invoices.length > 0;
  if (!hasData) {
    return (
      <div className="glass-card" style={{ padding: '24px 20px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-light)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
          <TrendingUp size={24} color="var(--primary)" />
        </div>
        <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '6px' }}>مرحباً بك في لوحة تحليلات المكتب</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 16px auto', lineHeight: '1.5' }}>
          ستظهر هنا تلقائياً الرسوم البيانية لتوزيع القضايا ومعدلات إنجاز المهام والتحصيل المالي فور تسجيل أول ملف.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            onClick={() => setActiveTab('cases')} 
            style={{ padding: '8px 18px', background: 'var(--primary)', color: '#000', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            + تسجيل قضية جديدة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '16px' }}>
      {/* 1. Case Status Distribution Chart */}
      <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <PieChart size={18} />
              توزيع حالات القضايا
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>إجمالي: {cases.length} قضية</span>
          </div>

          {/* Visual Multi-Segment Bar */}
          <div style={{ height: '14px', width: '100%', borderRadius: '7px', display: 'flex', overflow: 'hidden', backgroundColor: 'var(--bg-progress)', marginBottom: '16px' }}>
            <div style={{ width: `${activePct}%`, backgroundColor: 'var(--success)', transition: 'width 0.5s ease' }} title={`نشطة: ${activeCases}`} />
            <div style={{ width: `${pendingPct}%`, backgroundColor: 'var(--warning)', transition: 'width 0.5s ease' }} title={`معلقة: ${pendingCases}`} />
            <div style={{ width: `${closedPct}%`, backgroundColor: 'var(--info)', transition: 'width 0.5s ease' }} title={`مغلقة: ${closedCases}`} />
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--success)' }}></span>
                قيد النظر والنشطة
              </span>
              <span style={{ fontWeight: '700' }}>{activeCases} ({activePct}%)</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--warning)' }}></span>
                معلقة / انتظار مستندات
              </span>
              <span style={{ fontWeight: '700' }}>{pendingCases} ({pendingPct}%)</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--info)' }}></span>
                مغلقة ومحسومة
              </span>
              <span style={{ fontWeight: '700' }}>{closedCases} ({closedPct}%)</span>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setActiveTab('cases')} 
          style={{ marginTop: '16px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--primary)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', width: '100%' }}
        >
          عرض قائمة القضايا ←
        </button>
      </div>

      {/* 2. Task Completion Rate Chart */}
      <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <CheckCircle2 size={18} />
              معدل إنجاز المهام المكتبية
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>إجمالي: {tasks.length} مهمة</span>
          </div>

          {/* Circle Gauge or Large Progress Counter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', margin: '14px 0' }}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: `conic-gradient(var(--success) ${donePct * 3.6}deg, var(--bg-progress) 0deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                %{donePct}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)' }}>نسبة اكتمال المهام</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>تم إنجاز {doneTasks} من أصل {tasks.length} مهمة مسندة</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
            <div style={{ padding: '8px 12px', background: 'var(--bg-item)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>قيد التنفيذ</div>
              <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--warning)' }}>{inProgressTasks}</div>
            </div>
            <div style={{ padding: '8px 12px', background: 'var(--bg-item)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>في الانتظار (To Do)</div>
              <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--info)' }}>{todoTasks}</div>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setActiveTab('tasks')} 
          style={{ marginTop: '16px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--primary)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', width: '100%' }}
        >
          لوحة الكانبان والمتابعة ←
        </button>
      </div>

      {/* 3. Financial Collections Rate */}
      <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <DollarSign size={18} />
              معدل تحصيل الأتعاب
            </h3>
            <span className="badge badge-active">%{collectionRate} محصل</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '14px 0' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>المبالغ المستلمة</span>
                <span style={{ fontWeight: '700', color: 'var(--success)' }}>{paidAmount.toLocaleString()} د.ل</span>
              </div>
              <div style={{ height: '8px', width: '100%', backgroundColor: 'var(--bg-progress)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${collectionRate}%`, height: '100%', backgroundColor: 'var(--success)', borderRadius: '4px' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>المبالغ المتبقية</span>
                <span style={{ fontWeight: '700', color: 'var(--error)' }}>{pendingAmount.toLocaleString()} د.ل</span>
              </div>
              <div style={{ height: '8px', width: '100%', backgroundColor: 'var(--bg-progress)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${100 - collectionRate}%`, height: '100%', backgroundColor: 'var(--error)', borderRadius: '4px' }} />
              </div>
            </div>
          </div>

          <div style={{ padding: '10px', background: 'rgba(212, 168, 83, 0.1)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '600' }}>إجمالي الفواتير الصادرة</span>
            <span style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '0.95rem' }}>{Number(totalInvoiced).toLocaleString()} د.ل</span>
          </div>
        </div>

        <button 
          onClick={() => setActiveTab('finance')} 
          style={{ marginTop: '16px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--primary)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', width: '100%' }}
        >
          إدارة الفواتير والتحصيل ←
        </button>
      </div>
    </div>
  );
}
