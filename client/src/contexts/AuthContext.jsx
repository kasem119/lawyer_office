import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMe = async () => {
      const token = localStorage.getItem('access_token');
      // Always try fetching, relying on cookie as fallback if token missing
      try {
        const res = await apiFetch('/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setTenant(data.tenant);
          setSubscription(data.subscription);
        } else {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      } catch (err) {
        console.error('Auth verification failed:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, []);

  const login = async (email, password, tenantSlug) => {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, tenantSlug })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'فشل تسجيل الدخول');

    if (data.accessToken) localStorage.setItem('access_token', data.accessToken);
    if (data.refreshToken) localStorage.setItem('refresh_token', data.refreshToken);
    setUser(data.user);
    setTenant(data.tenant);
    setSubscription(data.subscription);
    return data;
  };

  const registerOffice = async (officeData) => {
    const res = await apiFetch('/onboarding/register-office', {
      method: 'POST',
      body: JSON.stringify(officeData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'فشل إنشاء الحساب');

    if (data.accessToken) localStorage.setItem('access_token', data.accessToken);
    if (data.refreshToken) localStorage.setItem('refresh_token', data.refreshToken);
    setUser(data.user);
    setTenant(data.tenant);
    setSubscription(data.subscription);
    return data;
  };

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch(e) {}
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    setTenant(null);
    setSubscription(null);
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <AuthContext.Provider value={{ user, tenant, subscription, loading, login, registerOffice, logout, isAdmin, isSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
