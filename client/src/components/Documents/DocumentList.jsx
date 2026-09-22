import React, { useState, useEffect } from 'react';
import { FileText, Download, History, Share2, Trash2 } from 'lucide-react';
import SearchBar from '../Shared/SearchBar';
import DataTable from '../Shared/DataTable';
import Button from '../Shared/Button';
import Modal from '../Shared/Modal';
import DocumentVersions from './DocumentVersions';
import DocumentShare from './DocumentShare';
import { apiFetch, getServerUrl } from '../../api/client';

export default function DocumentList() {
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState('all');
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [selectedDocForVersions, setSelectedDocForVersions] = useState(null);
  const [selectedDocForShare, setSelectedDocForShare] = useState(null);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const res = await apiFetch('/cases');
        if (res.ok) {
          const data = await res.json();
          setCases(data.cases || []);
        }
      } catch (err) {
        console.error('Error loading cases:', err);
      }
    };
    fetchCases();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCaseId !== 'all') params.append('case_id', selectedCaseId);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await apiFetch(`/documents?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [selectedCaseId, searchQuery]);

  const handleDownload = (docId) => {
    window.open(`${getServerUrl()}/api/documents/download/${docId}`, '_blank');
  };

  const handleDelete = async (docId, docName) => {
    if (!window.confirm(`هل أنت متأكد من حذف المستند (${docName}) نهائياً من النظام والقرص؟`)) {
      return;
    }
    try {
      const res = await apiFetch(`/documents/${docId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        alert('تم حذف المستند بنجاح');
        fetchDocuments();
      } else {
        alert(data.message || 'فشل حذف المستند');
      }
    } catch (err) {
      alert('حدث خطأ أثناء الاتصال بالخادم');
    }
  };

  const columns = [
    {
      header: 'اسم المستند',
      accessor: 'original_name',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} color="var(--primary)" />
          <div>
            <span style={{ fontWeight: '700', display: 'block' }}>{row.original_name}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {row.file_size ? `${(row.file_size / 1024).toFixed(1)} KB` : ''}
              {row.uploader_name ? ` • بواسطة ${row.uploader_name}` : ''}
            </span>
          </div>
        </div>
      )
    },
    {
      header: 'القضية المرتبطة',
      accessor: 'case_title',
      render: (row) => (
        <div>
          <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{row.case_title}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', direction: 'ltr', display: 'inline-block' }}>{row.case_number}</div>
          {row.client_name && (
            <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>الموكل: {row.client_name}</div>
          )}
        </div>
      )
    },
    {
      header: 'الإصدار الحالي',
      accessor: 'current_version',
      render: (row) => <span className="badge badge-active">v{row.current_version}</span>
    },
    {
      header: 'تاريخ الرفع',
      accessor: 'created_at',
      render: (row) => new Date(row.created_at).toLocaleDateString('ar-LY')
    },
    {
      header: 'إجراءات',
      render: (row) => (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <Button variant="secondary" icon={Download} onClick={() => handleDownload(row.id)} style={{ padding: '4px 8px', fontSize: '0.78rem' }}>تحميل</Button>
          <Button variant="secondary" icon={History} onClick={() => setSelectedDocForVersions(row)} style={{ padding: '4px 8px', fontSize: '0.78rem' }}>الإصدارات</Button>
          <Button variant="secondary" icon={Share2} onClick={() => setSelectedDocForShare(row)} style={{ padding: '4px 8px', fontSize: '0.78rem' }}>مشاركة</Button>
          <Button variant="danger" icon={Trash2} onClick={() => handleDelete(row.id, row.original_name)} style={{ padding: '4px 8px', fontSize: '0.78rem' }}>حذف</Button>
        </div>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)' }}>متصفح الأرشيف والمستندات</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>استعراض ومشاركة وحذف وثائق قضايا المكتب بشكل موحد</p>
      </div>

      <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="بحث باسم المستند أو القضية أو الموكل..." />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>فلترة حسب القضية:</span>
          <select className="form-select" style={{ padding: '6px 12px', fontSize: '0.85rem' }} value={selectedCaseId} onChange={(e) => setSelectedCaseId(e.target.value)}>
            <option value="all">جميع القضايا ({documents.length} مستند)</option>
            {cases.map(c => (
              <option key={c.id} value={c.id}>{c.case_number} - {c.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '16px' }}>
        <DataTable columns={columns} data={documents} emptyMessage={loading ? 'جاري تحميل المستندات...' : 'لا توجد مستندات مسجلة'} />
      </div>

      <Modal isOpen={!!selectedDocForVersions} onClose={() => setSelectedDocForVersions(null)} title="تاريخ إصدارات المستند">
        {selectedDocForVersions && <DocumentVersions document={selectedDocForVersions} onUpdated={fetchDocuments} />}
      </Modal>

      <Modal isOpen={!!selectedDocForShare} onClose={() => setSelectedDocForShare(null)} title="مشاركة المستند مع محامي">
        {selectedDocForShare && <DocumentShare document={selectedDocForShare} onShared={() => setSelectedDocForShare(null)} />}
      </Modal>
    </div>
  );
}
