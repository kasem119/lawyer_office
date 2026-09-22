import React, { useState } from 'react';
import { Upload, File } from 'lucide-react';
import Button from '../Shared/Button';
import { apiFetch } from '../../api/client';

export default function DocumentUpload({ caseId, onUploaded }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return setError('يرجى تحديد ملف لرفعه');
    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('case_id', caseId);

    try {
      const res = await apiFetch('/documents/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'فشل رفع الملف');
      onUploaded();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {error && <div style={{ background: 'rgba(244,63,94,0.2)', color: 'var(--error)', padding: '10px', borderRadius: '6px', fontSize: '0.9rem' }}>{error}</div>}

      <div style={{
        border: '2px dashed var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '30px',
        textAlign: 'center',
        background: 'var(--bg-item)',
        cursor: 'pointer'
      }}>
        <input type="file" onChange={handleFileChange} id="doc-file-input" style={{ display: 'none' }} />
        <label htmlFor="doc-file-input" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <Upload size={36} color="var(--primary)" />
          <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>اضغط هنا لاختيار مستند أو اسحب الملف هنا</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>يدعم صيغ PDF, Word, الصور والوثائق (حجم أقصى 50MB)</span>
        </label>
      </div>

      {file && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: 'var(--primary-light)', borderRadius: '6px', fontSize: '0.9rem' }}>
          <File size={18} color="var(--primary)" />
          <span style={{ fontWeight: '600' }}>{file.name}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <Button type="submit" disabled={loading || !file}>
          {loading ? 'جاري الرفع...' : 'رفع المستند'}
        </Button>
      </div>
    </form>
  );
}
