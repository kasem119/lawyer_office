import React, { useState, useEffect } from 'react';
import { Users, Plus, Eye, Edit, Trash2, FileText, FileSpreadsheet } from 'lucide-react';
import SearchBar from '../Shared/SearchBar';
import DataTable from '../Shared/DataTable';
import Button from '../Shared/Button';
import Modal from '../Shared/Modal';
import ClientForm from './ClientForm';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../api/client';
import { downloadBlob } from '../../utils/exportUtils';

export default function ClientList({ onViewClient }) {
  const { isAdmin } = useAuth();
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchClients = async () => {

    setLoading(true);
    try {
      const res = await apiFetch('/clients');
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      setFilteredClients(clients.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.national_id && c.national_id.includes(q))
      ));
    } else {
      setFilteredClients(clients);
    }
  }, [searchQuery, clients]);

  const handleCreateOrUpdateClient = async (formData) => {
    const isEdit = !!editingClient;
    const url = isEdit ? `/clients/${editingClient.id}` : '/clients';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
      method,
      body: JSON.stringify(formData)
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.isConflict) {
        const confirmForce = window.confirm(`تنبيه تعارض مصالح: ${data.message}\nهل ترغب في إضافة العميل بالرغم من وجود بيانات مشابهة؟`);
        if (confirmForce) {
          return handleCreateOrUpdateClient({ ...formData, force: true });
        }
      }
      throw new Error(data.message || 'فشل حفظ بيانات العميل');
    }
    setIsModalOpen(false);
    setEditingClient(null);
    fetchClients();
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const res = await apiFetch(`/exports/clients?format=${format}`);
      if (res.ok) {
        const blob = await res.blob();
        downloadBlob(blob, `clients.${format === 'excel' ? 'xlsx' : 'pdf'}`);
      } else {
        alert('فشل التصدير');
      }
    } catch (err) {
      alert('خطأ في التصدير');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteClient = async (client) => {
    if (!window.confirm(`هل أنت متأكد من حذف العميل "${client.name}" من الدليل؟`)) return;

    try {
      const res = await apiFetch(`/clients/${client.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'تم حذف العميل بنجاح');
        fetchClients();
      } else {
        if (data.hasLinkedCases) {
          const forceConfirm = window.confirm(`${data.message}\n\nهل ترغب في الحذف الإجباري للعميل مع كافة قضاياه؟`);
          if (forceConfirm) {
            const forceRes = await apiFetch(`/clients/${client.id}?force=true`, { method: 'DELETE' });
            if (forceRes.ok) {
              alert('تم الحذف بنجاح.');
              fetchClients();
            } else {
              const errData = await forceRes.json();
              alert(errData.message || 'فشل الحذف الإجباري');
            }
          }
        } else {
          alert(data.message || 'فشل حذف العميل');
        }
      }
    } catch (err) {
      alert(err.message || 'فشل حذف العميل');
    }
  };

  const columns = [
    {
      header: 'اسم العميل / الشركة',
      accessor: 'name',
      render: (row) => <span style={{ fontWeight: '700', color: 'var(--primary)' }}>{row.name}</span>
    },
    {
      header: 'الرقم الوطني / السجل (مشفر)',
      accessor: 'national_id',
      render: (row) => <span style={{ direction: 'ltr', display: 'inline-block' }}>{row.national_id || 'غير مدخل'}</span>
    },
    {
      header: 'رقم الهاتف',
      accessor: 'phone',
      render: (row) => <span style={{ direction: 'ltr', display: 'inline-block' }}>{row.phone || 'غير مدخل'}</span>
    },
    {
      header: 'البريد الإلكتروني',
      accessor: 'email',
      render: (row) => row.email || '-'
    },
    {
      header: 'العنوان',
      accessor: 'address',
      render: (row) => row.address || '-'
    },
    {
      header: 'إجراءات وتحكم',
      render: (row) => (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => onViewClient(row.id)}
            title="عرض ملف وتفاصيل وقضايا العميل"
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Eye size={15} color="var(--primary)" />
            ملف العميل
          </button>

          <button
            onClick={() => { setEditingClient(row); setIsModalOpen(true); }}
            title="تعديل بيانات العميل"
            className="btn btn-secondary"
            style={{ padding: '6px 8px', fontSize: '0.8rem' }}
          >
            <Edit size={15} />
          </button>

          {isAdmin && (
            <button
              onClick={() => handleDeleteClient(row)}
              title="حذف العميل (مدير المكتب)"
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
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)' }}>دليل العملاء الأصلاء</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>إدارة سجلات وبيانات عملاء المكتب والتحكم في الملفات</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button icon={FileText} onClick={() => handleExport('pdf')} variant="secondary" disabled={exporting}>
            {exporting ? 'جاري التصدير...' : 'تصدير PDF'}
          </Button>
          <Button icon={FileSpreadsheet} onClick={() => handleExport('excel')} variant="secondary" disabled={exporting}>
            {exporting ? 'جاري التصدير...' : 'تصدير Excel'}
          </Button>
          <Button icon={Plus} onClick={() => { setEditingClient(null); setIsModalOpen(true); }}>إضافة عميل جديد</Button>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '16px' }}>
        <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="بحث باسم العميل، الهاتف، أو الرقم الوطني..." />
      </div>

      <div className="glass-card" style={{ padding: '16px' }}>
        <DataTable columns={columns} data={filteredClients} emptyMessage={loading ? 'جاري تحميل البيانات...' : 'لا يوجد عملاء مطبقين للبحث'} />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingClient(null); }} title={editingClient ? `تعديل بيانات العميل (${editingClient.name})` : 'إضافة عميل جديد للدليل'}>
        <ClientForm initialValues={editingClient} onSave={handleCreateOrUpdateClient} onCancel={() => { setIsModalOpen(false); setEditingClient(null); }} />
      </Modal>
    </div>
  );
}
