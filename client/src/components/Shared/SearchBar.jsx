import React from 'react';
import { Search } from 'lucide-react';

export default function SearchBar({ value, onChange, placeholder = 'بحث...' }) {
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
      <Search size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
      <input
        type="text"
        className="form-input"
        style={{ paddingRight: '38px', width: '100%' }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
