import React, { useState, useEffect, useRef } from 'react';
import { Database, Download, RefreshCw, HardDrive, RotateCcw, UploadCloud, CheckCircle2, AlertTriangle, Archive } from 'lucide-react';
import Button from '../Shared/Button';
import DataTable from '../Shared/DataTable';
import { apiFetch, getServerUrl } from '../../api/client';

export default function BackupManager() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const fileInputRef = useRef(null);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/backups');
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    setMessage('');
    try {
      const res = await apiFetch('/backups/create', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setMessage('✅ تم إنشاء النسخة الاحتياطية الشاملة (قاعدة البيانات + مجلد المرفقات بالكامل) بنجاح');
        setMessageType('success');
        fetchBackups();
      } else {
        setMessage(`❌ فشل الإنشاء: ${data.message}`);
        setMessageType('error');
      }
    } catch (err) {
      setMessage('❌ حدث خطأ في الاتصال بالخادم');
      setMessageType('error');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = (filename) => {
    const token = localStorage.getItem('access_token');
    const url = `${getServerUrl()}/api/backups/download/${encodeURIComponent(filename)}`;
    
    // Trigger download with auth header using fetch/blob
    apiFetch(`/backups/download/${encodeURIComponent(filename)}`)
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
      })
      .catch(() => {
        // Fallback
        window.open(url, '_blank');
      });
  };

  const handleRestore = async (filename) => {
    const isConfirm = window.confirm(
      `⚠️ تحذير أمني هام:\n\nهل أنت متأكد من رغبتك في استعادة النظام من النسخة (${filename})؟\n\nسيتم استبدال قاعدة البيانات والمرفقات الحالية بالكامل بالبيانات الموجودة في هذه النسخة الاحتياطية. سيقوم النظام بحفظ نقطة استعادة تلقائية قبل المتابعة.`
    );
    if (!isConfirm) return;

    setRestoring(true);
    setMessage('');
    try {
      const res = await apiFetch('/backups/restore', {
        method: 'POST',
        body: JSON.stringify({ filename })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ ${data.message || 'تمت استعادة المنظومة بنجاح'}`);
        setMessageType('success');
        fetchBackups();
      } else {
        setMessage(`❌ فشل الاستعادة: ${data.message}`);
        setMessageType('error');
      }
    } catch (err) {
      setMessage('❌ حدث خطأ أثناء عملية الاستعادة');
      setMessageType('error');
    } finally {
      setRestoring(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isConfirm = window.confirm(
      `⚠️ هل تريد رفع واستعادة ملف النسخة الاحتياطية (${file.name}) فوراً؟\nسيتم استبدال البيانات الحالية بمحتويات الملف المرفوع.`
    );
    if (!isConfirm) {
      e.target.value = '';
      return;
    }

    setRestoring(true);
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('backup_file', file);

      const res = await apiFetch('/backups/restore', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ ${data.message || 'تم رفع واستعادة النسخة بنجاح'}`);
        setMessageType('success');
        fetchBackups();
      } else {
        setMessage(`❌ فشل الاستعادة: ${data.message}`);
        setMessageType('error');
      }
    } catch (err) {
      setMessage('❌ حدث خطأ أثناء رفع واستعادة النسخة');
      setMessageType('error');
    } finally {
      setRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const columns = [
    {
      header: 'ملف النسخة الاحتياطية',
      accessor: 'filename',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {row.isFullZip ? (
            <Archive size={18} color="var(--success)" title="نسخة شاملة (قاعدة بيانات + مرفقات)" />
          ) : (
            <Database size={18} color="var(--primary)" title="نسخة قاعدة بيانات فقط" />
          )}
          <div>
            <span style={{ direction: 'ltr', display: 'inline-block', fontWeight: '700', color: 'var(--primary)' }}>
              {row.filename}
            </span>
            <div style={{ fontSize: '0.72rem', color: row.isFullZip ? 'var(--success)' : 'var(--text-muted)' }}>
              {row.isFullZip ? '📦 شاملة (داتابيز + مرفقات ZIP)' : '📄 قاعدة بيانات فقط (.db)'}
            </div>
          </div>
        </div>
      )
    },
    {
      header: 'الحجم',
      accessor: 'size',
      render: (row) => `${(row.size / 1024 / 1024).toFixed(2)} MB`
    },
    {
      header: 'تاريخ الإنشاء',
      accessor: 'createdAt',
      render: (row) => new Date(row.createdAt).toLocaleString('ar-LY')
    },
    {
      header: 'إجراءات النسخة',
      render: (row) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            variant="secondary"
            icon={Download}
            onClick={() => handleDownload(row.filename)}
            style={{ padding: '4px 10px', fontSize: '0.8rem' }}
          >
            تنزيل
          </Button>
          <Button
            variant="secondary"
            icon={RotateCcw}
            onClick={() => handleRestore(row.filename)}
            disabled={restoring}
            style={{ padding: '4px 10px', fontSize: '0.8rem', color: 'var(--warning)', borderColor: 'var(--warning)' }}
          >
            استعادة
          </Button>
        </div>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Database size={26} />
            إدارة النسخ الاحتياطي والأمان
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            يتم إنشاء نسخة شاملة تلقائياً لقاعدة البيانات والمرفقات يومياً مع إمكانية التنزيل والاستعادة المباشرة
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".zip,.db"
            style={{ display: 'none' }}
          />
          <Button
            variant="secondary"
            icon={UploadCloud}
            onClick={() => fileInputRef.current?.click()}
            disabled={restoring}
          >
            استعادة من ملف خارجي
          </Button>
          <Button icon={HardDrive} onClick={handleCreateBackup} disabled={creating || restoring}>
            {creating ? 'جاري إنشاء النسخة...' : 'إنشاء نسخة شاملة فورية (ZIP)'}
          </Button>
        </div>
      </div>

      {restoring && (
        <div className="glass-card" style={{ padding: '16px', border: '1px solid var(--warning)', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <RefreshCw size={20} className="animate-spin" color="var(--warning)" />
          <span style={{ fontWeight: '700', color: 'var(--warning)' }}>جاري استعادة المنظومة وتحديث السجلات والملفات، يرجى الانتظار...</span>
        </div>
      )}

      {message && (
        <div
          className="glass-card"
          style={{
            padding: '12px 18px',
            fontWeight: '600',
            fontSize: '0.9rem',
            border: `1px solid ${messageType === 'error' ? 'var(--error)' : 'var(--success)'}`,
            background: messageType === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'
          }}
        >
          {message}
        </div>
      )}

      <div className="glass-card" style={{ padding: '16px' }}>
        <DataTable
          columns={columns}
          data={backups}
          emptyMessage={loading ? 'جاري تحميل قائمة النسخ الاحتياطية...' : 'لا توجد نسخ احتياطية مسجلة'}
        />
      </div>
    </div>
  );
}
