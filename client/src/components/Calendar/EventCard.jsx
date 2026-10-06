import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, Briefcase, Edit2, Trash2, Bell } from 'lucide-react';
import { apiFetch } from '../../api/client';

export default function EventCard({ event, onEdit, onDelete }) {
  const [reminding, setReminding] = useState(false);

  const handleSendReminder = async () => {
    setReminding(true);
    try {
      const res = await apiFetch(`/events/${event.id}/remind`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'تم إرسال التنبيه الفوري للمحامي بنجاح');
      } else {
        alert(data.message || 'فشل إرسال التنبيه');
      }
    } catch (err) {
      alert('تعذر الاتصال بالخادم لإرسال التنبيه');
    } finally {
      setReminding(false);
    }
  };

  const typeMap = {
    court_date: { label: 'جلسة محكمة', color: 'var(--warning)', badgeClass: 'badge-pending' },
    meeting: { label: 'اجتماع', color: 'var(--info)', badgeClass: 'badge-medium' },
    deadline: { label: 'مهلة قانونية', color: 'var(--error)', badgeClass: 'badge-urgent' },
    consultation: { label: 'استشارة', color: 'var(--success)', badgeClass: 'badge-active' }
  };

  const item = typeMap[event.event_type] || { label: event.event_type, color: 'var(--primary)', badgeClass: 'badge-pending' };

  return (
    <div className="glass-card" style={{ padding: '16px', borderRight: `4px solid ${item.color}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: '700' }}>{event.title}</h4>
          <span className={`badge ${item.badgeClass}`}>
            {item.label}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={15} color="var(--primary)" />
            <span>{event.date} {event.time ? `(${event.time})` : ''}</span>
          </div>

          {event.location && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={15} color="var(--primary)" />
              <span>{event.location}</span>
            </div>
          )}

          {event.case_title && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Briefcase size={15} color="var(--primary)" />
              <span>القضية: {event.case_title} (<span style={{ direction: 'ltr', display: 'inline-block' }}>{event.case_number}</span>)</span>
            </div>
          )}

          {event.description && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {event.description}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '12px' }}>
        <button
          onClick={handleSendReminder}
          disabled={reminding}
          title="إرسال تذكير فوري للمحامي المكلف"
          style={{
            background: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            borderRadius: '6px',
            color: 'var(--warning)',
            cursor: reminding ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 8px',
            fontSize: '0.78rem',
            fontWeight: '600'
          }}
        >
          <Bell size={13} />
          {reminding ? 'جاري الإرسال...' : 'تذكير المحامي'}
        </button>

        <div style={{ display: 'flex', gap: '8px' }}>
          {onEdit && (
            <button
              onClick={() => onEdit(event)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.8rem',
                fontWeight: '600'
              }}
            >
              <Edit2 size={14} />
              تعديل
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(event)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--error)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.8rem',
                fontWeight: '600'
              }}
            >
              <Trash2 size={14} />
              حذف
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
