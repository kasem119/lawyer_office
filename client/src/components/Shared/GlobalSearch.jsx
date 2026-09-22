import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../api/client';
import { Search, Briefcase, Users, CheckSquare, Calendar, X } from 'lucide-react';

export default function GlobalSearch({ onNavigate }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (query.trim().length === 0) {
      setResults(null);
      setIsOpen(false);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timerRef.current);
  }, [query]);

  const performSearch = async (searchTerm) => {
    try {
      setLoading(true);
      const res = await apiFetch(`/search?q=${encodeURIComponent(searchTerm)}`);
      if (res.ok) {
        const json = await res.json();
        setResults(json.data || null);
        setIsOpen(true);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults(null);
    setIsOpen(false);
  };

  const handleItemClick = (type, item) => {
    if (onNavigate) {
      if (type === 'case') {
        onNavigate('case_details', item.id);
      } else if (type === 'client') {
        onNavigate('client_details', item.id);
      } else if (type === 'task') {
        onNavigate('tasks', item.id);
      } else if (type === 'event') {
        onNavigate('calendar', item.id);
      }
    }
    setIsOpen(false);
    setQuery('');
  };

  const hasResults = results && (
    (results.cases && results.cases.length > 0) ||
    (results.clients && results.clients.length > 0) ||
    (results.tasks && results.tasks.length > 0) ||
    (results.events && results.events.length > 0)
  );

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search size={18} style={{ position: 'absolute', right: '12px', color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="بحث سريع في القضايا، الموكلين، المهام..."
          style={{
            width: '100%',
            padding: '8px 38px 8px 32px',
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-main)',
            outline: 'none',
            fontSize: '0.85rem',
            direction: 'rtl'
          }}
          onFocus={() => {
            if (query.trim().length > 0) setIsOpen(true);
          }}
        />
        {query && (
          <X 
            size={16} 
            onClick={handleClear}
            style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)', cursor: 'pointer' }} 
          />
        )}
      </div>

      {isOpen && (
        <div className="glass-card" style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          right: 0,
          zIndex: 100,
          maxHeight: '400px',
          overflowY: 'auto',
          borderRadius: 'var(--radius-md)',
          padding: '8px 0',
          direction: 'rtl',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-card)'
        }}>
          {loading && !results && <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>جاري البحث...</div>}
          
          {!loading && !hasResults && results && (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>لا توجد نتائج مطابقة لبحثك</div>
          )}

          {hasResults && (
            <>
              <ResultSection
                title="القضايا (انقر للعرض)"
                icon={<Briefcase size={16} />}
                items={results.cases}
                renderItem={(item) => `${item.title} (${item.case_number})`}
                onItemClick={(item) => handleItemClick('case', item)}
              />
              <ResultSection
                title="العملاء (انقر للملف)"
                icon={<Users size={16} />}
                items={results.clients}
                renderItem={(item) => `${item.name} ${item.phone ? ' - ' + item.phone : ''}`}
                onItemClick={(item) => handleItemClick('client', item)}
              />
              <ResultSection
                title="المهام (انقر للانتقال)"
                icon={<CheckSquare size={16} />}
                items={results.tasks}
                renderItem={(item) => item.title}
                onItemClick={(item) => handleItemClick('task', item)}
              />
              <ResultSection
                title="المواعيد والجلسات (انقر للتقويم)"
                icon={<Calendar size={16} />}
                items={results.events}
                renderItem={(item) => `${item.title} (${item.date || ''})`}
                onItemClick={(item) => handleItemClick('event', item)}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ResultSection({ title, icon, items, renderItem, onItemClick }) {
  if (!items || items.length === 0) return null;
  
  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: '700' }}>
        {icon}
        <span>{title}</span>
      </div>
      <div>
        {items.map((item, idx) => (
          <div 
            key={idx} 
            onClick={() => onItemClick && onItemClick(item)}
            style={{ 
              padding: '8px 14px', 
              color: 'var(--text-main)', 
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-light)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
}
