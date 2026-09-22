import React, { useState, useEffect } from 'react';
import { Plus, FileText, FileSpreadsheet } from 'lucide-react';
import TaskCard from './TaskCard';
import TaskForm from './TaskForm';
import Button from '../Shared/Button';
import Modal from '../Shared/Modal';
import { apiFetch } from '../../api/client';
import { downloadBlob } from '../../utils/exportUtils';

export default function TaskBoard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [dragOverCol, setDragOverCol] = useState(null);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleMoveStatus = async (taskId, newStatus) => {
    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

    try {
      const res = await apiFetch(`/tasks/${taskId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        fetchTasks();
      }
    } catch (err) {
      console.error(err);
      fetchTasks();
    }
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskIdStr = e.dataTransfer.getData('taskId');
    if (!taskIdStr) return;
    const taskId = parseInt(taskIdStr, 10);
    handleMoveStatus(taskId, newStatus);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleDeleteTask = async (task) => {
    if (!window.confirm(`هل أنت متأكد من حذف المهمة "${task.title}"؟`)) {
      return;
    }
    try {
      const res = await apiFetch(`/tasks/${task.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchTasks();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'فشل حذف المهمة');
      }
    } catch (err) {
      alert('حدث خطأ أثناء الاتصال بالخادم');
    }
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const res = await apiFetch(`/exports/tasks?format=${format}`);
      if (res.ok) {
        const blob = await res.blob();
        downloadBlob(blob, `tasks.${format === 'excel' ? 'xlsx' : 'pdf'}`);
      } else {
        alert('فشل التصدير');
      }
    } catch (err) {
      alert('خطأ في التصدير');
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    { id: 'todo', title: 'قيد الانتظار (To Do)', color: 'var(--text-muted)' },
    { id: 'in_progress', title: 'جاري العمل (In Progress)', color: 'var(--info)' },
    { id: 'review', title: 'تحت المراجعة (Review)', color: 'var(--warning)' },
    { id: 'done', title: 'مكتملة (Done)', color: 'var(--success)' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)' }}>لوحة متابعة المهام والتكليفات (Kanban)</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            سحب وإفلات المهام ومتابعة سير الإجراءات وتعديلها بسهولة
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button icon={FileText} onClick={() => handleExport('pdf')} variant="secondary" disabled={exporting}>
            {exporting ? 'جاري التصدير...' : 'تصدير PDF'}
          </Button>
          <Button icon={FileSpreadsheet} onClick={() => handleExport('excel')} variant="secondary" disabled={exporting}>
            {exporting ? 'جاري التصدير...' : 'تصدير Excel'}
          </Button>
          <Button icon={Plus} onClick={() => { setEditingTask(null); setIsModalOpen(true); }}>إسناد مهمة جديدة</Button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '50px' }}>جاري تحميل لوحة المهام...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px', flex: 1, overflowX: 'auto', minWidth: '950px' }}>
          {columns.map((col) => {
            const colTasks = tasks.filter(t => t.status === col.id);
            const isOver = dragOverCol === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverCol !== col.id) setDragOverCol(col.id);
                }}
                onDragLeave={() => {
                  if (dragOverCol === col.id) setDragOverCol(null);
                }}
                onDrop={(e) => handleDrop(e, col.id)}
                className="glass-card"
                style={{
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  background: isOver ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-card)',
                  border: isOver ? '2px dashed var(--primary)' : '1px solid var(--border-color)',
                  transition: 'background 0.2s ease, border 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${col.color}`, paddingBottom: '10px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: col.color }}>{col.title}</h3>
                  <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: '700' }}>{colTasks.length}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
                  {colTasks.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'center', padding: '20px' }}>
                      اسحب المهام وأفلتها هنا
                    </div>
                  ) : (
                    colTasks.map((t) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        onMoveStatus={handleMoveStatus}
                        onEdit={handleEditTask}
                        onDelete={handleDeleteTask}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingTask(null); }}
        title={editingTask ? 'تعديل بيانات المهمة' : 'إسناد مهمة جديدة إلى محامي'}
      >
        <TaskForm
          initialValues={editingTask}
          onSaved={() => { setIsModalOpen(false); setEditingTask(null); fetchTasks(); }}
          onCancel={() => { setIsModalOpen(false); setEditingTask(null); }}
        />
      </Modal>
    </div>
  );
}
