import React, { useState, useEffect } from 'react';
import EmptyState from './EmptyState';
import { LayoutList, Table as TableIcon } from 'lucide-react';
import useMediaQuery from '../../hooks/useMediaQuery';

export default function DataTable({ 
  columns, 
  data = [], 
  emptyMessage = 'لا توجد بيانات متاحة حالياً',
  emptyDescription = 'لم يتم تسجيل أي بيانات في هذا الجدول حتى الآن.',
  emptyActionLabel,
  onEmptyAction
}) {
  const isMobileScreen = useMediaQuery('(max-width: 768px)');

  const [viewMode, setViewMode] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth <= 768 ? 'cards' : 'table';
  });

  useEffect(() => {
    if (isMobileScreen) setViewMode('cards');
  }, [isMobileScreen]);

  if (data.length === 0) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <EmptyState
          title={emptyMessage}
          description={emptyDescription}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
          compact
        />
      </div>
    );
  }

  // Identify action column and status column for card layout
  const actionsCol = columns.find(c => 
    c.header === 'إجراءات وتحكم' || 
    c.header === 'إجراءات' || 
    (!c.accessor && c.render)
  );

  const statusCol = columns.find(c => c.accessor === 'status');
  
  // Primary title column (usually 1st or 2nd)
  const titleCol = columns.find(c => c.accessor === 'title' || c.accessor === 'name')
    || columns.find(c => c.accessor === 'case_number') || columns[0];

  // Other detail columns
  const detailCols = columns.filter(c => c !== actionsCol && c !== titleCol);

  return (
    <div style={{ width: '100%' }}>
      {/* View Mode Switcher on mobile screens */}
      {isMobileScreen && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <div style={{
            display: 'inline-flex',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '3px',
            gap: '4px'
          }}>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              aria-pressed={viewMode === 'cards'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'cards' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'cards' ? '#fff' : 'var(--text-muted)',
                fontSize: '0.78rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <LayoutList size={14} />
              <span>بطاقات</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              aria-pressed={viewMode === 'table'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'table' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'table' ? '#fff' : 'var(--text-muted)',
                fontSize: '0.78rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <TableIcon size={14} />
              <span>جدول</span>
            </button>
          </div>
        </div>
      )}

      {/* Cards View for Mobile Phones */}
      {isMobileScreen && viewMode === 'cards' ? (
        <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {data.map((row, rowIdx) => (
            <div key={rowIdx} className="datatable-mobile-card">
              {/* Header: Title and Status */}
              <div className="datatable-mobile-card-header">
                <div className="datatable-mobile-card-title" style={{ flex: 1, minWidth: 0 }}>
                  {titleCol ? (titleCol.render ? titleCol.render(row) : row[titleCol.accessor]) : `#${rowIdx + 1}`}
                </div>
                {statusCol && (
                  <div style={{ flexShrink: 0 }}>
                    {statusCol.render ? statusCol.render(row) : row[statusCol.accessor]}
                  </div>
                )}
              </div>

              {/* Body: Key fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 0' }}>
                {detailCols.map((col, cIdx) => {
                  if (col === statusCol) return null;
                  const value = col.render ? col.render(row) : row[col.accessor];
                  if (value === undefined || value === null || value === '') return null;
                  return (
                    <div key={cIdx} className="datatable-mobile-card-field">
                      <span className="datatable-mobile-card-label">{col.header}:</span>
                      <span className="datatable-mobile-card-value">{value}</span>
                    </div>
                  );
                })}
              </div>

              {/* Actions Footer */}
              {actionsCol && (
                <div className="datatable-mobile-card-actions">
                  {actionsCol.render(row)}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Standard Table View with Horizontal Scroll & Sticky Header */
        <div style={{ overflowX: 'auto', width: '100%', borderRadius: 'var(--radius-sm)', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', minWidth: isMobileScreen ? '650px' : 'auto' }}>
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
                      position: 'sticky',
                      top: 0,
                      ...col.headerStyle
                    }}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIdx) => (
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
