import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Plus, LayoutGrid, List, Trash2, Edit2, Printer } from 'lucide-react';
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
  
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportWeek, setExportWeek] = useState('current');
  const [exportFormat, setExportFormat] = useState('pdf');
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

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('token');
      let url = `/api/export/events?format=${exportFormat}`;
      if (exportWeek !== 'all') {
        url += `&week=${exportWeek}`;
      }

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Export failed');
      
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = downloadUrl;
      a.download = `events_${exportWeek}.${exportFormat === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      setIsExportModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء التصدير');
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

          <Button icon={Printer} variant="secondary" onClick={() => setIsExportModalOpen(true)}>
            طباعة / تصدير
          </Button>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '14px' }}>
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

      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="طباعة / تصدير جدول المواعيد"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>الفترة</label>
            <select 
              value={exportWeek} 
              onChange={(e) => setExportWeek(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}
            >
              <option value="current">الأسبوع الحالي</option>
              <option value="next">الأسبوع القادم</option>
              <option value="all">جميع المواعيد</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem' }}>الصيغة</label>
            <select 
              value={exportFormat} 
              onChange={(e) => setExportFormat(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}
            >
              <option value="pdf">PDF (طباعة)</option>
              <option value="excel">Excel (جداول)</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setIsExportModalOpen(false)}>إلغاء</Button>
            <Button onClick={handleExport} icon={Printer}>تصدير</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
