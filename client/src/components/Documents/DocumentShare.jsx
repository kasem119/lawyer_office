import React, { useState, useEffect } from 'react';
import { Share2 } from 'lucide-react';
import Button from '../Shared/Button';
import { apiFetch } from '../../api/client';

export default function DocumentShare({ document, onShared }) {
  const [lawyers, setLawyers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [permissions, setPermissions] = useState('view');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLawyers = async () => {
      try {
        const res = await apiFetch('/users');
        if (res.ok) {
          const data = await res.json();
          setLawyers(data.users || []);
          if (data.users.length > 0) setSelectedUser(data.users[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchLawyers();
  }, []);

  const handleShare = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await apiFetch('/documents/share', {
        method: 'POST',
        body: JSON.stringify({
          document_id: document.id,
          shared_with_user_id: selectedUser,
          permissions
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'فشل مشاركة المستند');
      onShared();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleShare} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h4 style={{ color: 'var(--primary)', fontWeight: '700' }}>مشاركة: {document.original_name}</h4>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>اختر المحامي الصميل ونوع الصلاحية الممنوحة له</p>
      </div>

      {error && <div style={{ background: 'rgba(244,63,94,0.2)', color: 'var(--error)', padding: '10px', borderRadius: '6px', fontSize: '0.9rem' }}>{error}</div>}

      <div className="form-group">
        <label className="form-label">اختر المحامي المشارك معه *</label>
        <select className="form-select" value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
          {lawyers.map(l => (
            <option key={l.id} value={l.id}>{l.name} ({l.email})</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">صلاحية التداول الممنوحة</label>
        <select className="form-select" value={permissions} onChange={(e) => setPermissions(e.target.value)}>
          <option value="view">عرض وقراءة فقط (View Only)</option>
          <option value="download">عرض وتنزيل الملف (Download)</option>
          <option value="edit">إتاحة رفع نسخة تعديلية (Edit)</option>
        </select>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <Button type="submit" disabled={loading}>
          {loading ? 'جاري المشاركة...' : 'إرسال المشاركة'}
        </Button>
      </div>
    </form>
  );
}
