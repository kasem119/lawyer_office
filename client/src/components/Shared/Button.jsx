import React from 'react';

export default function Button({ children, variant = 'primary', icon: Icon, onClick, type = 'button', disabled = false, style }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant}`}
      style={{ opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer', ...style }}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
}
