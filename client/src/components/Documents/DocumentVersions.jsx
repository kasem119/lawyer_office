import React, { useState, useEffect } from 'react';
import { History, Upload, Download } from 'lucide-react';
import Button from '../Shared/Button';
import { apiFetch, getServerUrl } from '../../api/client';

export default function DocumentVersions({ document, onUpdated }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newFile, setNewFile] = useState(null);
  const [changeNote, setChangeNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/documents/${document.id}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, [document.id]);

  const handleUploadNewVersion = async (e) => {
    e.preventDefault();
    if (!newFile) return setError('يرجى تحديد ملف النسخة الجديدة');
    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', newFile);
    formData.append('change_note', changeNote);

    try {
      const res = await apiFetch(`/documents/${document.id}/version`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'فشل إضافة الإصدار');
      setNewFile(null);
      setChangeNote('');
      fetchVersions();
      onUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h4 style={{ color: 'var(--primary)', fontWeight: '700' }}>المستند: {document.original_name}</h4>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>الإصدار الحالي: v{document.current_version}</p>
      </div>

      {/* Form: Add New Version */}
      <form onSubmit={handleUploadNewVersion} style={{ background: 'var(--bg-item)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
        <h5 style={{ marginBottom: '10px', fontSize: '0.95rem' }}>إضافة نسخة تعديلية جديدة للمستند</h5>
        {error && <div style={{ background: 'rgba(244,63,94,0.2)', color: 'var(--error)', padding: '8px', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '10px' }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <input type="file" onChange={(e) => setNewFile(e.target.files[0])} className="form-input" style={{ fontSize: '0.85rem' }} />
          <input type="text" className="form-input" placeholder="ملاحظة التعديل (مثال: مراجعة العقد وتدقيق البند الـ 4)..." value={changeNote} onChange={(e) => setChangeNote(e.target.value)} />
        </div>

        <Button type="submit" disabled={uploading || !newFile} style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
          {uploading ? 'جاري الرفع...' : 'حفظ النسخة الجديدة'}
        </Button>
      </form>

      {/* Version History List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h5 style={{ color: 'var(--text-muted)' }}>سجل جميع الإصدارات السابقة:</h5>
        {loading ? (
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>جاري تحميل التراكم التعديلي...</p>
        ) : (
          versions.map((v) => (
            <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-item)', borderRadius: '6px', borderRight: '3px solid var(--primary)', border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>
                  الإصدار v{v.version_number} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>({new Date(v.created_at).toLocaleString('ar-LY')})</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ملاحظة التغيير: {v.change_note || 'بدون ملاحظة'} | بواسطة: {v.uploader_name}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
