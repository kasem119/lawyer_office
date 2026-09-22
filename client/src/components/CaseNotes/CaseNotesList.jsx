import React, { useState, useEffect } from 'react';
import { FileText, Bell, Gavel, Scale, Phone, Mail, Users, Lock, Edit, Trash2, Plus } from 'lucide-react';
import { apiFetch } from '../../api/client';
import CaseNoteForm from './CaseNoteForm';

const getIcon = (type) => {
  switch (type) {
    case 'note': return <FileText size={18} />;
    case 'update': return <Bell size={18} />;
    case 'court_result': return <Gavel size={18} />;
    case 'phone_call': return <Phone size={18} />;
    case 'email': return <Mail size={18} />;
    case 'meeting': return <Users size={18} />;
    default: return <FileText size={18} />;
  }
};

const getTypeLabel = (type) => {
  switch (type) {
    case 'note': return 'ملاحظة عامة';
    case 'update': return 'تحديث حالة';
    case 'court_result': return 'نتيجة جلسة';
    case 'phone_call': return 'مكالمة هاتفية';
    case 'email': return 'بريد إلكتروني';
    case 'meeting': return 'اجتماع';
    default: return 'ملاحظة';
  }
};

const CaseNotesList = ({ caseId }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/case-notes/${caseId}`);
      if (res.ok) {
        const json = await res.json();
        setNotes(json.data || []);
      }
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setCurrentUser(user);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) {
      fetchNotes();
    }
  }, [caseId]);

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الملاحظة؟')) return;
    try {
      const res = await apiFetch(`/case-notes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchNotes();
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert(errJson.message || 'حدث خطأ أثناء الحذف');
      }
    } catch (error) {
      console.error('Delete error', error);
    }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>جاري تحميل الملاحظات...</div>;

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, color: 'var(--primary)', fontWeight: '700', fontSize: '1.1rem' }}>سجل الملاحظات والتطورات الزمنية</h3>
        <button 
          onClick={() => { setEditingNote(null); setShowForm(true); }}
          className="btn btn-primary"
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          <Plus size={16} />
          إضافة ملاحظة جديدة
        </button>
      </div>

      {showForm && (
        <div className="glass-card" style={{ marginBottom: '20px', padding: '20px' }}>
          <CaseNoteForm 
            caseId={caseId} 
            note={editingNote} 
            onSaved={() => { setShowForm(false); setEditingNote(null); fetchNotes(); }} 
            onCancel={() => { setShowForm(false); setEditingNote(null); }} 
          />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {notes.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>لا توجد ملاحظات مسجلة لهذه القضية حتى الآن.</p>
        ) : (
          notes.map(note => (
            <div key={note.id} className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: 'var(--primary-light)', padding: '8px', borderRadius: '50%', color: 'var(--primary)', display: 'flex' }}>
                    {getIcon(note.note_type)}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{note.author_name}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>• {getTypeLabel(note.note_type)}</span>
                      {note.is_private === 1 && <span className="badge badge-urgent" style={{ fontSize: '0.7rem' }}><Lock size={12} /> خاصة</span>}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(note.created_at).toLocaleString('ar-LY')}
                    </div>
                  </div>
                </div>
                {(currentUser?.role === 'admin' || currentUser?.id === note.created_by) && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {currentUser?.id === note.created_by && (
                      <button onClick={() => { setEditingNote(note); setShowForm(true); }} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer' }} title="تعديل">
                        <Edit size={16} />
                      </button>
                    )}
                    <button onClick={() => handleDelete(note.id)} style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer' }} title="حذف">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
              <div style={{ color: 'var(--text-main)', whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '0.92rem' }}>
                {note.content}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CaseNotesList;
