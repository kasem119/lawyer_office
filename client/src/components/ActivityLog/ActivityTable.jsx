import React from 'react';
import {
  Clock,
  Briefcase,
  Users,
  FileText,
  Receipt,
  CheckSquare,
  Calendar,
  User,
  DollarSign,
  Database,
  ShieldAlert,
  Activity,
  Info,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { getActionBadge, formatDateTime, parseDetails, DetailsSnippet } from './ActivityDetailModal';

const ENTITY_CONFIG = {
  case: { label: 'قضية', icon: Briefcase, color: 'var(--primary)' },
  client: { label: 'عميل', icon: Users, color: 'var(--info)' },
  document: { label: 'مستند', icon: FileText, color: 'var(--warning)' },
  invoice: { label: 'فاتورة', icon: Receipt, color: 'var(--success)' },
  task: { label: 'مهمة', icon: CheckSquare, color: '#06b6d4' },
  event: { label: 'موعد / جلسة', icon: Calendar, color: '#8b5cf6' },
  user: { label: 'مستخدم', icon: User, color: '#ec4899' },
  expense: { label: 'مصروف', icon: DollarSign, color: '#f59e0b' },
  time_entry: { label: 'تتبع وقت', icon: Clock, color: '#10b981' },
  case_note: { label: 'ملاحظة قضية', icon: FileText, color: '#6366f1' },
  backup: { label: 'نسخة احتياطية', icon: Database, color: '#64748b' },
  conflict: { label: 'تعارض مصالح', icon: ShieldAlert, color: '#ef4444' }
};

export default function ActivityTable({
  activities,
  loading,
  error,
  page,
  setPage,
  limit,
  setLimit,
  totalPages,
  totalCount,
  onSelectDetail
}) {
  return (
    <div className="glass-card responsive-table-container" style={{ padding: '0px', overflow: 'hidden' }}>
      {error && (
        <div style={{ padding: '16px', color: 'var(--error)', backgroundColor: 'rgba(244, 63, 94, 0.1)', borderBottom: '1px solid rgba(244, 63, 94, 0.2)' }}>
          {error}
        </div>
      )}

      <div style={{ overflowX: 'auto', width: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-table-header)' }}>
              <th style={{ padding: '14px 16px', color: 'var(--primary)', fontSize: '0.88rem', fontWeight: '700' }}>التاريخ والوقت</th>
              <th style={{ padding: '14px 16px', color: 'var(--primary)', fontSize: '0.88rem', fontWeight: '700' }}>المستخدم</th>
              <th style={{ padding: '14px 16px', color: 'var(--primary)', fontSize: '0.88rem', fontWeight: '700' }}>نوع العملية</th>
              <th style={{ padding: '14px 16px', color: 'var(--primary)', fontSize: '0.88rem', fontWeight: '700' }}>الكيان المتأثر</th>
              <th style={{ padding: '14px 16px', color: 'var(--primary)', fontSize: '0.88rem', fontWeight: '700' }}>تفاصيل إضافية</th>
              <th style={{ padding: '14px 16px', color: 'var(--primary)', fontSize: '0.88rem', fontWeight: '700', textAlign: 'center' }}>معاينة</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  جاري تحميل سجل النشاطات...
                </td>
              </tr>
            ) : activities.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  لا توجد نشاطات مسجلة تطابق معايير البحث المحددة.
                </td>
              </tr>
            ) : (
              activities.map((item) => {
                const actionBadge = getActionBadge(item.action);
                const ActionIcon = actionBadge.icon;
                const entityMeta = ENTITY_CONFIG[item.entity_type?.toLowerCase()] || {
                  label: item.entity_type,
                  icon: Activity,
                  color: 'var(--text-muted)'
                };
                const EntityIcon = entityMeta.icon;
                const detailsObj = parseDetails(item.details_json);

                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }} className="table-row-hover">
                    {/* Timestamp */}
                    <td style={{ padding: '14px 16px', fontSize: '0.88rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={14} color="var(--primary)" />
                        <span style={{ direction: 'ltr', display: 'inline-block' }}>{formatDateTime(item.created_at)}</span>
                      </div>
                    </td>

                    {/* User */}
                    <td style={{ padding: '14px 16px', fontSize: '0.9rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: item.user_role === 'admin' ? 'rgba(212, 168, 83, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                          color: item.user_role === 'admin' ? 'var(--primary)' : 'var(--info)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                          fontSize: '0.85rem'
                        }}>
                          {item.user_name ? item.user_name.charAt(0) : 'U'}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                            {item.user_name || `مستخدم #${item.user_id}`}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {item.user_role === 'admin' ? 'مدير النظام' : 'محامي'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Action */}
                    <td style={{ padding: '14px 16px', fontSize: '0.88rem' }}>
                      <span
                        className={actionBadge.className}
                        style={{
                          ...actionBadge.style,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '0.8rem',
                          fontWeight: '600'
                        }}
                      >
                        <ActionIcon size={14} />
                        <span>{actionBadge.label}</span>
                      </span>
                    </td>

                    {/* Entity */}
                    <td style={{ padding: '14px 16px', fontSize: '0.9rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <EntityIcon size={16} color={entityMeta.color} />
                        <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{entityMeta.label}</span>
                        {item.entity_id && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-item)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                            #{item.entity_id}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Details Summary */}
                    <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: 'var(--text-main)', maxWidth: '300px' }}>
                      <DetailsSnippet details={detailsObj} />
                    </td>

                    {/* View Button */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => onSelectDetail(item)}
                        className="btn btn-secondary"
                        title="عرض التفاصيل الكاملة"
                        style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Info size={14} color="var(--primary)" />
                        تفاصيل
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 20px',
        borderTop: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-table-header)',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          إجمالي النتائج: <strong style={{ color: 'var(--primary)' }}>{totalCount}</strong> عملية مسجلة
          (صفحة {page} من {totalPages})
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span>العدد بالصفحة:</span>
            <select
              className="form-select"
              style={{ padding: '4px 8px', fontSize: '0.82rem' }}
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.85rem', opacity: page <= 1 ? 0.5 : 1 }}
            >
              <ChevronRight size={16} />
              السابق
            </button>

            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.85rem', opacity: page >= totalPages ? 0.5 : 1 }}
            >
              التالي
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
