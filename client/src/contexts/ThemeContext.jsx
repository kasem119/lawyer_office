import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Stored preference: 'dark' | 'light' | 'auto'
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('app_theme');
    if (saved === 'light' || saved === 'dark' || saved === 'auto') {
      return saved;
    }
    return 'dark'; // Default fallback
  });

  // Calculate system preference
  const getSystemTheme = useCallback(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  }, []);

  const [systemTheme, setSystemTheme] = useState(getSystemTheme);

  // Listen to OS preference changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  // Compute resolved active theme ('dark' or 'light')
  const resolvedTheme = theme === 'auto' ? systemTheme : theme;
  const isDark = resolvedTheme === 'dark';

  // Apply data-theme attribute to <html> element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  // Update theme setting and persist to localStorage
  const setTheme = useCallback((newTheme) => {
    if (newTheme === 'dark' || newTheme === 'light' || newTheme === 'auto') {
      setThemeState(newTheme);
      localStorage.setItem('app_theme', newTheme);
    }
  }, []);

  // Quick toggle between dark and light
  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('app_theme', next);
      return next;
    });
  }, []);

  // Cycle through dark -> light -> auto -> dark
  const cycleTheme = useCallback(() => {
    setThemeState(prev => {
      let next;
      if (prev === 'dark') next = 'light';
      else if (prev === 'light') next = 'auto';
      else next = 'dark';
      localStorage.setItem('app_theme', next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      resolvedTheme, 
      isDark, 
      setTheme, 
      toggleTheme, 
      cycleTheme 
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

