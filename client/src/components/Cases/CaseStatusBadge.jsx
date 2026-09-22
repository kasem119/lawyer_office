import React from 'react';

export default function CaseStatusBadge({ status }) {
  const statusMap = {
    active: { label: 'نشطة', class: 'badge-active' },
    pending: { label: 'معلقة', class: 'badge-pending' },
    closed: { label: 'مغلقة', class: 'badge-closed' },
    archived: { label: 'مؤرشفة', class: 'badge-closed' }
  };

  const item = statusMap[status] || { label: status, class: 'badge-pending' };

  return <span className={`badge ${item.class}`}>{item.label}</span>;
}
