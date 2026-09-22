import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon, Clock, MapPin, Plus } from 'lucide-react';

const MONTH_NAMES = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const DAY_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const TYPE_CONFIG = {
  court_date: { label: 'جلسة', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.5)', color: '#ef4444' },
  meeting: { label: 'اجتماع', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.5)', color: '#3b82f6' },
  deadline: { label: 'مهلة', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.5)', color: '#f59e0b' },
  consultation: { label: 'استشارة', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.5)', color: '#10b981' }
};

export default function CalendarGrid({ events = [], onSelectEvent, onAddEventForDate }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterType, setFilterType] = useState('all');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonthDays = new Date(year, month, 0).getDate();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Filter events
  const filteredEvents = filterType === 'all'
    ? events
    : events.filter(e => e.event_type === filterType);

  // Group events by date string "YYYY-MM-DD"
  const eventsByDate = {};
  for (const ev of filteredEvents) {
    if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
    eventsByDate[ev.date].push(ev);
  }

  // Generate 42 calendar grid cells (6 rows x 7 cols)
  const days = [];

  // Trailing days from previous month
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    const prevM = month === 0 ? 12 : month;
    const prevY = month === 0 ? year - 1 : year;
    const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    days.push({ dayNum, dateStr, isCurrentMonth: false });
  }

  // Days in current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ dayNum: d, dateStr, isCurrentMonth: true });
  }

  // Next month filler
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    const nextM = month === 11 ? 1 : month + 2;
    const nextY = month === 11 ? year + 1 : year;
    const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ dayNum: d, dateStr, isCurrentMonth: false });
  }

  return (
    <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Calendar Header Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--primary)', margin: 0 }}>
            {MONTH_NAMES[month]} {year}
          </h2>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={handlePrevMonth}
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', color: 'var(--text-main)' }}
              title="الشهر السابق"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={handleToday}
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main)' }}
            >
              اليوم
            </button>
            <button
              onClick={handleNextMonth}
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', color: 'var(--text-main)' }}
              title="الشهر القادم"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>

        {/* Filter by Type */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>نوع الموعد:</span>
          <select
            className="form-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ padding: '4px 10px', fontSize: '0.82rem', minWidth: '130px' }}
          >
            <option value="all">جميع المواعيد</option>
            <option value="court_date">جلسات محكمة</option>
            <option value="meeting">اجتماعات</option>
            <option value="deadline">مهل قانونية</option>
            <option value="consultation">استشارات</option>
          </select>
        </div>
      </div>

      {/* Days of Week Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center', fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        {DAY_NAMES.map((name, i) => (
          <div key={i} style={{ color: (i === 5 || i === 6) ? 'var(--warning)' : 'inherit' }}>
            {name}
          </div>
        ))}
      </div>

      {/* Month Days Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
        {days.map((item, index) => {
          const dayEvents = eventsByDate[item.dateStr] || [];
          const isToday = item.dateStr === todayStr;

          return (
            <div
              key={index}
              style={{
                minHeight: '105px',
                padding: '6px',
                borderRadius: '8px',
                background: isToday ? 'rgba(59, 130, 246, 0.08)' : item.isCurrentMonth ? 'var(--bg-input)' : 'rgba(0,0,0,0.1)',
                border: isToday ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                opacity: item.isCurrentMonth ? 1 : 0.45,
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.15s ease',
                position: 'relative'
              }}
            >
              {/* Day Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{
                  fontSize: '0.85rem',
                  fontWeight: isToday ? '800' : '600',
                  color: isToday ? 'var(--primary)' : 'var(--text-main)',
                  width: '22px',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  background: isToday ? 'var(--primary-light)' : 'transparent'
                }}>
                  {item.dayNum}
                </span>

                {item.isCurrentMonth && (
                  <button
                    onClick={() => onAddEventForDate && onAddEventForDate(item.dateStr)}
                    title={`إضافة موعد في ${item.dateStr}`}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      opacity: 0.6
                    }}
                    onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseOut={(e) => e.currentTarget.style.opacity = '0.6'}
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>

              {/* Day Events Chips */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflowY: 'auto', maxHeight: '72px' }}>
                {dayEvents.map((ev) => {
                  const cfg = TYPE_CONFIG[ev.event_type] || TYPE_CONFIG.court_date;
                  return (
                    <div
                      key={ev.id}
                      onClick={() => onSelectEvent && onSelectEvent(ev)}
                      title={`${ev.title} (${ev.time || ''})`}
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: cfg.bg,
                        border: `1px solid ${cfg.border}`,
                        color: cfg.color,
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>{ev.time ? ev.time.slice(0, 5) : ''}</span>
                      <span>{ev.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
