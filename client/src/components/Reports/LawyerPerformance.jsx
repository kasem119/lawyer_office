import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';

export default function LawyerPerformance() {
  const [lawyers, setLawyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPerformance();
  }, []);

  const fetchPerformance = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/reports/lawyer-performance');
      if (res.ok) {
        const json = await res.json();
        setLawyers(json.data || []);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.message || 'حدث خطأ أثناء تحميل بيانات المحامين');
      }
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء تحميل بيانات المحامين');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>جاري التحميل...</div>;
  if (error) return <div style={{ color: 'var(--error)', padding: '20px', textAlign: 'center' }}>{error}</div>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
            <th style={{ padding: '12px', fontWeight: '700' }}>اسم المحامي</th>
            <th style={{ padding: '12px', fontWeight: '700' }}>إجمالي القضايا</th>
            <th style={{ padding: '12px', fontWeight: '700' }}>المهام المنجزة</th>
            <th style={{ padding: '12px', fontWeight: '700' }}>نسبة الإنجاز</th>
          </tr>
        </thead>
        <tbody>
          {lawyers.map((lawyer) => (
            <tr key={lawyer.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '12px', color: 'var(--text-main)', fontWeight: '600' }}>{lawyer.name}</td>
              <td style={{ padding: '12px', color: 'var(--text-main)' }}>{lawyer.total_cases}</td>
              <td style={{ padding: '12px', color: 'var(--text-main)' }}>{lawyer.tasks_completed} / {lawyer.tasks_total}</td>
              <td style={{ padding: '12px', minWidth: '150px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, height: '8px', backgroundColor: 'var(--bg-progress)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${lawyer.completion_rate}%`, height: '100%', backgroundColor: lawyer.completion_rate > 75 ? 'var(--success)' : lawyer.completion_rate > 40 ? 'var(--warning)' : 'var(--error)', borderRadius: '4px' }}></div>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>%{lawyer.completion_rate}</span>
                </div>
              </td>
            </tr>
          ))}
          {lawyers.length === 0 && (
            <tr>
              <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>لا يوجد محامين لعرض بياناتهم</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
