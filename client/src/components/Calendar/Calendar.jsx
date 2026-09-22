import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Plus, LayoutGrid, List, Trash2, Edit2 } from 'lucide-react';
import EventCard from './EventCard';
import EventForm from './EventForm';
import CalendarGrid from './CalendarGrid';
import Button from '../Shared/Button';
import Modal from '../Shared/Modal';
import { apiFetch } from '../../api/client';

export default function Calendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleOpenCreate = (dateStr = null) => {
    setEditingEvent(null);
    setSelectedDate(dateStr);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (event) => {
    setEditingEvent(event);
    setSelectedDate(event.date);
    setIsModalOpen(true);
  };

  const handleDeleteEvent = async (event) => {
    if (!window.confirm(`هل أنت متأكد من حذف الموعد "${event.title}" من التقويم؟`)) {
      return;
    }
    try {
      const res = await apiFetch(`/events/${event.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchEvents();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'فشل حذف الموعد');
      }
    } catch (err) {
      alert('حدث خطأ أثناء الاتصال بالخادم');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CalendarIcon size={26} />
            التقويم والجدول الإجرائي
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            متابعة مواعيد الجلسات والاجتماعات والمهل القانونية عبر شبكة التقويم الشهرية
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '3px' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'grid' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <LayoutGrid size={15} />
              تقويم شبكي
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'list' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'list' ? '#fff' : 'var(--text-muted)',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <List size={15} />
              قائمة بطاقات
            </button>
          </div>

          <Button icon={Plus} onClick={() => handleOpenCreate()}>إضافة موعد جديد</Button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '50px' }}>جاري تحميل التقويم...</div>
      ) : viewMode === 'grid' ? (
        <CalendarGrid
          events={events}
          onSelectEvent={handleOpenEdit}
          onAddEventForDate={handleOpenCreate}
        />
      ) : events.length === 0 ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          لا توجد مواعيد أو جلسات مسجلة في التقويم حالياً
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
          {events.map((evt) => (
            <EventCard
              key={evt.id}
              event={evt}
              onEdit={handleOpenEdit}
              onDelete={handleDeleteEvent}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingEvent(null); }}
        title={editingEvent ? 'تعديل بيانات الموعد' : 'إضافة حدث جديد للتقويم'}
      >
        <EventForm
          initialValues={editingEvent}
          defaultDate={selectedDate}
          onSaved={() => { setIsModalOpen(false); setEditingEvent(null); fetchEvents(); }}
          onCancel={() => { setIsModalOpen(false); setEditingEvent(null); }}
        />
      </Modal>
    </div>
  );
}
