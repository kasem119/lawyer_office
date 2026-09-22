import React from 'react';
import EmptyState from './EmptyState';

export default function DataTable({ 
  columns, 
  data = [], 
  emptyMessage = 'لا توجد بيانات متاحة حالياً',
  emptyDescription = 'لم يتم تسجيل أي بيانات في هذا الجدول حتى الآن.',
  emptyActionLabel,
  onEmptyAction
}) {
  return (
    <div style={{ overflowX: 'auto', width: '100%', borderRadius: 'var(--radius-sm)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-table-header)' }}>
            {columns.map((col, idx) => (
              <th
                key={idx}
                style={{
                  padding: '14px 16px',
                  color: 'var(--primary)',
                  fontSize: '0.88rem',
                  fontWeight: '700',
                  whiteSpace: 'nowrap',
                  ...col.headerStyle
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '24px 16px' }}>
                <EmptyState
                  title={emptyMessage}
                  description={emptyDescription}
                  actionLabel={emptyActionLabel}
                  onAction={onEmptyAction}
                  compact
                />
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  transition: 'background-color 0.18s ease'
                }}
                className="table-row-hover"
              >
                {columns.map((col, colIdx) => (
                  <td
                    key={colIdx}
                    style={{
                      padding: '13px 16px',
                      fontSize: '0.9rem',
                      color: 'var(--text-main)',
                      ...col.cellStyle
                    }}
                  >
                    {col.render ? col.render(row) : row[col.accessor]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

