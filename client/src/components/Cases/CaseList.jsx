import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, Eye, Edit, Trash2, CheckCircle2, RotateCcw, FileText, FileSpreadsheet } from 'lucide-react';
import SearchBar from '../Shared/SearchBar';
import DataTable from '../Shared/DataTable';
import Button from '../Shared/Button';
import Modal from '../Shared/Modal';
import CaseForm from './CaseForm';
import CaseStatusBadge from './CaseStatusBadge';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../api/client';
import { downloadBlob } from '../../utils/exportUtils';

export default function CaseList({ onViewCase }) {
  const { isAdmin } = useAuth();
  const [cases, setCases] = useState([]);
  const [filteredCases, setFilteredCases] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/cases');
      if (res.ok) {
        const data = await res.json();
        setCases(data.cases || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  useEffect(() => {
    let result = [...cases];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.case_number.toLowerCase().includes(q) ||
        c.client_name?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter);
    }
    if (typeFilter !== 'all') {
      result = result.filter(c => c.case_type === typeFilter);
    }
    setFilteredCases(result);
  }, [searchQuery, statusFilter, typeFilter, cases]);

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const res = await apiFetch(`/exports/cases?format=${format}`);
      if (res.ok) {
        const blob = await res.blob();
        downloadBlob(blob, `cases.${format === 'excel' ? 'xlsx' : 'pdf'}`);
      } else {
        alert('فشل التصدير');
      }
    } catch (err) {
      alert('خطأ في التصدير');
    } finally {
      setExporting(false);
    }
  };

  const handleCreateOrUpdateCase = async (formData) => {
    const isEdit = !!editingCase;
    const url = isEdit ? `/cases/${editingCase.id}` : '/cases';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
      method,
      body: JSON.stringify(formData)
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.isConflict) {
        const confirmForce = window.confirm(`تنبيه تعارض مصالح: ${data.message}\nهل ترغب في تجاوز التنبيه وإنشاء القضية؟`);
        if (confirmForce) {
          return handleCreateOrUpdateCase({ ...formData, force: true });
        }
      }
      throw new Error(data.message || 'فشل حفظ بيانات القضية');
    }
    setIsModalOpen(false);
    setEditingCase(null);
    fetchCases();
  };

  const handleToggleStatus = async (caseItem) => {
    const newStatus = caseItem.status === 'closed' ? 'active' : 'closed';
    const actionText = newStatus === 'closed' ? 'إغلاق القضية واعتبارها منتهية' : 'إعادة تنشيط القضية وفتحها';
    if (!window.confirm(`هل أنت متأكد من ${actionText} "${caseItem.title}"؟`)) return;

    try {
      const res = await apiFetch(`/cases/${caseItem.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchCases();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'يرجى التأكد من إعادة تشغيل الخادم (Server) لتطبيق التعديلات الجديدة.');
      }
    } catch (err) {
      alert(err.message || 'فشل تغيير حالة القضية');
    }
  };

  const handleDeleteCase = async (caseItem) => {
    if (!window.confirm(`⚠️ تحذير: هل أنت متأكد من حذف القضية "${caseItem.title}" نهائياً؟\nسيتم حذف كافة الجلسات والمهام والمستندات المرتبطة بها!`)) return;

    try {
      const res = await apiFetch(`/cases/${caseItem.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchCases();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'فشل حذف القضية. يرجى إعادة تشغيل الخادم.');
      }
    } catch (err) {
      alert(err.message || 'فشل حذف القضية');
    }
  };

  const columns = [
    {
      header: 'رقم القضية',
      accessor: 'case_number',
      render: (row) => <span style={{ direction: 'ltr', fontWeight: '700', color: 'var(--primary)' }}>{row.case_number}</span>
    },
    {
      header: 'عنوان القضية',
      accessor: 'title',
      render: (row) => <div style={{ fontWeight: '600' }}>{row.title}</div>
    },
    {
      header: 'العميل الأصيل',
      accessor: 'client_name'
    },
    {
      header: 'نوع القضية',
      accessor: 'case_type'
    },
    {
      header: 'المحكمة',
      accessor: 'court_name'
    },
    {
      header: 'الحالة',
      accessor: 'status',
      render: (row) => <CaseStatusBadge status={row.status} />
    },
    {
      header: 'المحامي المسؤول',
      accessor: 'lead_lawyer_name'
    },
    {
      header: 'إجراءات وتحكم',
      render: (row) => (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => onViewCase(row.id)}
            title="عرض ملف وتفاصيل القضية"
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Eye size={15} color="var(--primary)" />
            عرض
          </button>

          <button
            onClick={() => handleToggleStatus(row)}
            title={row.status === 'closed' ? 'إعادة تنشيط القضية' : 'إغلاق القضية / تحديد كمكتملة'}
            className="btn btn-secondary"
            style={{
              padding: '6px 10px',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: row.status === 'closed' ? 'var(--info)' : 'var(--success)'
            }}
          >
            {row.status === 'closed' ? <RotateCcw size={15} /> : <CheckCircle2 size={15} />}
            {row.status === 'closed' ? 'تنشيط' : 'إتمام'}
          </button>

          <button
            onClick={() => { setEditingCase(row); setIsModalOpen(true); }}
            title="تعديل بيانات القضية"
            className="btn btn-secondary"
            style={{ padding: '6px 8px', fontSize: '0.8rem' }}
          >
            <Edit size={15} />
          </button>

          {isAdmin && (
            <button
              onClick={() => handleDeleteCase(row)}
              title="حذف القضية (مدير المكتب)"
              className="btn btn-danger"
              style={{ padding: '6px 8px', fontSize: '0.8rem' }}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)' }}>سجل القضايا والملفات</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>إدارة متابعة وتداول قضايا المكتب والتحكم في الحالات</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button icon={FileText} onClick={() => handleExport('pdf')} variant="secondary" disabled={exporting}>
            {exporting ? 'جاري التصدير...' : 'تصدير PDF'}
          </Button>
          <Button icon={FileSpreadsheet} onClick={() => handleExport('excel')} variant="secondary" disabled={exporting}>
            {exporting ? 'جاري التصدير...' : 'تصدير Excel'}
          </Button>
          <Button icon={Plus} onClick={() => { setEditingCase(null); setIsModalOpen(true); }}>إضافة قضية جديدة</Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="بحث برقم القضية، العنوان، أو اسم العميل..." />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>الحالة:</span>
          <select className="form-select" style={{ padding: '6px 12px', fontSize: '0.85rem' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">الكل</option>
            <option value="active">نشطة (Active)</option>
            <option value="pending">معلقة (Pending)</option>
            <option value="closed">مغلقة / منتهية (Closed)</option>
            <option value="archived">مؤرشفة (Archived)</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>النوع:</span>
          <select className="form-select" style={{ padding: '6px 12px', fontSize: '0.85rem' }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">كل الأنواع</option>
            <option value="تجاري">تجاري</option>
            <option value="مدني">مدني</option>
            <option value="جنائي">جنائي</option>
            <option value="أحوال شخصية">أحوال شخصية</option>
            <option value="عمالي">عمالي</option>
            <option value="إداري">إداري</option>
            <option value="عقاري">عقاري</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="glass-card" style={{ padding: '16px' }}>
        <DataTable columns={columns} data={filteredCases} emptyMessage={loading ? 'جاري تحميل البيانات...' : 'لا توجد قضايا مطابقة للبحث'} />
      </div>

      {/* Create / Edit Case Modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingCase(null); }} title={editingCase ? `تعديل القضية (${editingCase.case_number})` : 'إضافة قضية جديدة إلى الملفات'}>
        <CaseForm initialValues={editingCase} onSave={handleCreateOrUpdateCase} onCancel={() => { setIsModalOpen(false); setEditingCase(null); }} />
      </Modal>
    </div>
  );
}
