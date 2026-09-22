import React, { useState, useEffect } from 'react';
import { UserCog, Plus, ShieldCheck, User, Pencil, Trash2 } from 'lucide-react';
import Button from '../Shared/Button';
import DataTable from '../Shared/DataTable';
import Modal from '../Shared/Modal';
import ConfirmDialog from '../Shared/ConfirmDialog';
import { apiFetch } from '../../api/client';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'lawyer',
    phone: ''
  });
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({ name: '', email: '', password: '', role: 'lawyer', phone: '', is_active: true });
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'lawyer',
      phone: user.phone || '',
      is_active: Boolean(user.is_active)
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiFetch(editingUser ? `/users/${editingUser.id}` : '/users', {
        method: editingUser ? 'PUT' : 'POST',
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'فشل حفظ بيانات المستخدم');
      setIsModalOpen(false);
      setEditingUser(null);
      setFormData({ name: '', email: '', password: '', role: 'lawyer', phone: '', is_active: true });
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      const res = await apiFetch(`/users/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'فشل حذف المستخدم');
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      setError(err.message || 'فشل حذف المستخدم');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      header: 'اسم المحامي / المستخدم',
      accessor: 'name',
      render: (row) => (
        <div style={{ fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {row.role === 'admin' ? <ShieldCheck size={18} color="var(--error)" /> : <User size={18} color="var(--primary)" />}
          {row.name}
        </div>
      )
    },
    {
      header: 'البريد الإلكتروني (اسم المستخدم)',
      accessor: 'email'
    },
    {
      header: 'الهاتف',
      accessor: 'phone',
      render: (row) => <span style={{ direction: 'ltr', display: 'inline-block' }}>{row.phone || 'غير مدخل'}</span>
    },
    {
      header: 'صلاحية النظام (الدور)',
      accessor: 'role',
      render: (row) => (
        <span className={`badge ${row.role === 'admin' ? 'badge-urgent' : 'badge-active'}`}>
          {row.role === 'admin' ? 'مدير النظام' : 'محامي'}
        </span>
      )
    },
    {
      header: 'الحالة',
      accessor: 'is_active',
      render: (row) => <span className={`badge ${row.is_active ? 'badge-active' : 'badge-closed'}`}>{row.is_active ? 'مفعل' : 'معطل'}</span>
    },
    {
      header: 'إجراءات',
      render: (row) => <div style={{ display: 'flex', gap: '6px' }}>
        <Button variant="secondary" icon={Pencil} onClick={() => openEditModal(row)} style={{ padding: '6px 10px', fontSize: '0.8rem' }}>تعديل</Button>
        <Button variant="danger" icon={Trash2} onClick={() => { setError(''); setDeleteTarget(row); }} style={{ padding: '6px 10px', fontSize: '0.8rem' }}>حذف</Button>
      </div>
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}><UserCog size={25} /> إدارة حسابات المحامين والمستخدمين</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>إضافة الحسابات وتعديل الاسم والبريد والهاتف والدور وحالة التفعيل وكلمة المرور</p>
        </div>
        <Button icon={Plus} onClick={openCreateModal}>إضافة محامي جديد</Button>
      </div>

      <div className="glass-card" style={{ padding: '16px' }}>
        {error && <div style={{ background: 'var(--error-light)', color: 'var(--error)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '12px' }}>{error}</div>}
        <DataTable columns={columns} data={users} emptyMessage={loading ? 'جاري تحميل قائمة المستخدمين...' : 'لا يوجد مستخدمون'} />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUser ? 'تعديل بيانات المستخدم' : 'إضافة محامي / مستخدم جديد بالنظام'}>
        <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && <div style={{ background: 'rgba(244,63,94,0.2)', color: 'var(--error)', padding: '10px', borderRadius: '6px', fontSize: '0.9rem' }}>{error}</div>}

          <div className="form-group">
            <label className="form-label">الاسم الكامل *</label>
            <input type="text" className="form-input" required placeholder="أ. عبد الله علي" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">البريد الإلكتروني *</label>
              <input type="email" className="form-input" required placeholder="lawyer@office.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label">{editingUser ? 'كلمة المرور الجديدة (اختياري)' : 'كلمة المرور الأوّلية *'}</label>
              <input type="password" className="form-input" required={!editingUser} minLength={editingUser ? 0 : 12} placeholder={editingUser ? 'اتركها فارغة للاحتفاظ بكلمة المرور الحالية' : '12 حرفًا على الأقل'} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">الهاتف</label>
              <input type="text" className="form-input" placeholder="09XXXXXXXX" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label">صلاحية النظام (الدور)</label>
              <select className="form-select" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                <option value="lawyer">محامي (Lawyer)</option>
                <option value="admin">مدير المكتب (Admin)</option>
              </select>
            </div>
          </div>

          {editingUser && (
            <div style={{ background: 'var(--bg-item)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', cursor: 'pointer' }}>
                <input type="checkbox" checked={Boolean(formData.is_active)} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />
                الحساب مفعّل ويمكنه تسجيل الدخول
              </label>
              <p style={{ margin: '7px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>التعطيل يحفظ بيانات المستخدم وسجل نشاطه، لكنه يمنعه من الدخول.</p>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Button type="submit">{editingUser ? 'حفظ التعديلات' : 'إضافة المستخدم'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="حذف حساب مستخدم"
        message={`هل تريد حذف حساب ${deleteTarget?.name || ''} نهائياً؟ لا يمكن التراجع عن ذلك. لا يمكن حذف الحسابات المرتبطة بقضايا أو سجلات عمل؛ عطّلها بدلاً من ذلك.`}
        confirmText="حذف نهائياً"
        onConfirm={handleDeleteUser}
        onCancel={() => !deleting && setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
