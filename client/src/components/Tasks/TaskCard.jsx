import React from 'react';
import { Clock, User, Briefcase, ArrowLeft, ArrowRight, Edit2, Trash2, GripVertical } from 'lucide-react';

export default function TaskCard({ task, onMoveStatus, onEdit, onDelete }) {
  const priorityColors = {
    urgent: 'var(--error)',
    high: 'var(--warning)',
    medium: 'var(--info)',
    low: 'var(--text-muted)'
  };

  const statusNextMap = {
    todo: 'in_progress',
    in_progress: 'review',
    review: 'done'
  };

  const statusPrevMap = {
    in_progress: 'todo',
    review: 'in_progress',
    done: 'review'
  };

  const handleDragStart = (e) => {
    e.dataTransfer.setData('taskId', String(task.id));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="glass-card"
      style={{
        padding: '14px',
        borderRight: `4px solid ${priorityColors[task.priority] || 'var(--primary)'}`,
        cursor: 'grab',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        userSelect: 'none'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
        <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)' }}>
          {task.title}
        </div>
        <GripVertical size={16} color="var(--text-muted)" style={{ opacity: 0.5, flexShrink: 0 }} />
      </div>

      {task.description && (
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '10px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {task.description}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <User size={14} color="var(--primary)" />
          <span>المكلف: <strong>{task.assigned_to_name}</strong></span>
        </div>

        {task.case_title && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Briefcase size={14} color="var(--primary)" />
            <span>{task.case_title}</span>
          </div>
        )}

        {task.due_date && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} color="var(--primary)" />
            <span>الاستحقاق: {task.due_date}</span>
          </div>
        )}
      </div>

      {/* Action and Navigation Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {onEdit && (
            <button
              onClick={() => onEdit(task)}
              title="تعديل المهمة"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '3px' }}
            >
              <Edit2 size={14} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(task)}
              title="حذف المهمة"
              style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '3px' }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {statusPrevMap[task.status] && (
            <button
              onClick={() => onMoveStatus(task.id, statusPrevMap[task.status])}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              <ArrowRight size={14} /> السابق
            </button>
          )}

          {statusNextMap[task.status] && (
            <button
              onClick={() => onMoveStatus(task.id, statusNextMap[task.status])}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              التالي <ArrowLeft size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
