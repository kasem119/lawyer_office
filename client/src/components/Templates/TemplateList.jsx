import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Edit3, 
  Trash2, 
  Sparkles, 
  Printer, 
  FileCheck, 
  ShieldCheck, 
  Mail, 
  Scroll, 
  BookOpen, 
  File, 
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import SearchBar from '../Shared/SearchBar';
import Button from '../Shared/Button';
import Modal from '../Shared/Modal';
import TemplateEditor from './TemplateEditor';
import TemplateGenerator from './TemplateGenerator';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

const CATEGORIES = [
  { id: 'all', label: 'جميع القوالب', icon: FileText },
  { id: 'contract', label: 'عقود واتفاقيات', icon: FileCheck },
  { id: 'power_of_attorney', label: 'توكيلات رسمية', icon: ShieldCheck },
  { id: 'letter', label: 'خطابات وإنذارات', icon: Mail },
  { id: 'motion', label: 'مذكرات دفاع ولوائح', icon: Scroll },
  { id: 'memo', label: 'مذكرات داخلية', icon: BookOpen },
  { id: 'other', label: 'أخرى', icon: File }
];

const CATEGORY_MAP = {
  contract: { label: 'عقد', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', icon: FileCheck },
  power_of_attorney: { label: 'توكيل', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.3)', icon: ShieldCheck },
  letter: { label: 'خطاب/إنذار', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', icon: Mail },
  motion: { label: 'مذكرة دفاع', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)', icon: Scroll },
  memo: { label: 'مذكرة داخلية', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.3)', icon: BookOpen },
  other: { label: 'أخرى', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)', icon: File }
};

export default function TemplateList() {
  const { isAdmin } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [filteredTemplates, setFilteredTemplates] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [generatingTemplate, setGeneratingTemplate] = useState(null);
  const [notification, setNotification] = useState(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Filter templates based on category and search query
  useEffect(() => {
    let result = [...templates];

    if (selectedCategory !== 'all') {
      result = result.filter(t => t.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(t => 
        t.name?.toLowerCase().includes(q) ||
        t.content_html?.toLowerCase().includes(q) ||
        CATEGORY_MAP[t.category]?.label.toLowerCase().includes(q)
      );
    }

    setFilteredTemplates(result);
  }, [selectedCategory, searchQuery, templates]);

  const showToast = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleOpenEditor = (template = null) => {
    setEditingTemplate(template);
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setEditingTemplate(null);
  };

  const handleSaveTemplate = () => {
    handleCloseEditor();
    fetchTemplates();
    showToast(editingTemplate ? 'تم تحديث القالب بنجاح' : 'تم إنشاء القالب الجديد بنجاح');
  };

  const handleOpenGenerator = (template) => {
    setGeneratingTemplate(template);
    setIsGeneratorOpen(true);
  };

  const handleCloseGenerator = () => {
    setIsGeneratorOpen(false);
    setGeneratingTemplate(null);
  };

  const handleDeleteTemplate = async (template) => {
    if (!window.confirm(`هل أنت متأكد من حذف القالب "${template.name}"؟`)) return;

    try {
      const res = await apiFetch(`/templates/${template.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('تم حذف القالب بنجاح');
        fetchTemplates();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.message || 'فشل حذف القالب', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء حذف القالب', 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Notification Toast */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10000,
          backgroundColor: notification.type === 'error' ? 'var(--error)' : 'var(--success)',
          color: '#ffffff',
          padding: '10px 20px',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: '600'
        }}>
          {notification.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Header Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={28} color="var(--primary)" />
            قوالب المستندات القانونية
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            إدارة النماذج القانونية وصياغة العقود واللوائح وتوليد المستندات تلقائياً
          </p>
        </div>

        <Button variant="primary" icon={Plus} onClick={() => handleOpenEditor(null)}>
          قالب جديد
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="بحث في القوالب والنصوص..."
          />

          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            إجمالي القوالب: <strong style={{ color: 'var(--primary)' }}>{filteredTemplates.length}</strong> من أصل {templates.length}
          </div>
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            const count = cat.id === 'all' 
              ? templates.length 
              : templates.filter(t => t.category === cat.id).length;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '20px',
                  border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                  background: isSelected ? 'var(--primary-light)' : 'var(--bg-item)',
                  color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '0.85rem',
                  fontWeight: isSelected ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={16} />
                <span>{cat.label}</span>
                <span style={{
                  background: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                  color: isSelected ? '#ffffff' : 'var(--text-dim)',
                  borderRadius: '10px',
                  padding: '1px 6px',
                  fontSize: '0.75rem',
                  fontWeight: '700'
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Templates Grid Cards */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '1rem' }}>
          جاري تحميل القوالب القانونية...
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <FileText size={48} style={{ opacity: 0.3, marginBottom: '16px', color: 'var(--primary)' }} />
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '8px' }}>لم يتم العثور على قوالب</h3>
          <p style={{ fontSize: '0.9rem', marginBottom: '20px' }}>
            {searchQuery ? 'لا توجد قوالب مطابقة لبحثك' : 'ابدأ بإضافة أول قالب قانوني للمكتب'}
          </p>
          <Button variant="primary" icon={Plus} onClick={() => handleOpenEditor(null)}>
            إنشاء قالب جديد الآن
          </Button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '20px'
        }}>
          {filteredTemplates.map(template => {
            const catInfo = CATEGORY_MAP[template.category] || CATEGORY_MAP.other;
            const CatIcon = catInfo.icon;
            const placeholderCount = (template.placeholders || []).length;

            return (
              <div
                key={template.id}
                className="glass-card"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                  position: 'relative'
                }}
              >
                {/* Card Header */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '12px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '0.78rem',
                      fontWeight: '700',
                      backgroundColor: catInfo.bg,
                      color: catInfo.color,
                      border: `1px solid ${catInfo.border}`
                    }}>
                      <CatIcon size={14} />
                      {catInfo.label}
                    </span>

                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      {template.created_at ? new Date(template.created_at).toLocaleDateString('ar-LY') : ''}
                    </span>
                  </div>

                  <h3 style={{
                    fontSize: '1.1rem',
                    fontWeight: '700',
                    color: 'var(--text-main)',
                    lineHeight: '1.4',
                    marginBottom: '10px'
                  }}>
                    {template.name}
                  </h3>

                  {/* Placeholders preview badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      المتغيرات ({placeholderCount}):
                    </span>
                    {(template.placeholders || []).slice(0, 3).map(p => (
                      <span key={p} style={{
                        backgroundColor: 'var(--bg-item)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '1px 6px',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        direction: 'ltr'
                      }}>
                        {`{{${p}}}`}
                      </span>
                    ))}
                    {placeholderCount > 3 && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: '600' }}>
                        +{placeholderCount - 3} أخرى
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '14px',
                  marginTop: '4px'
                }}>
                  <Button
                    variant="primary"
                    icon={Sparkles}
                    onClick={() => handleOpenGenerator(template)}
                    style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                  >
                    توليد مستند
                  </Button>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => handleOpenEditor(template)}
                      className="btn btn-secondary"
                      style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                      title="تعديل القالب"
                    >
                      <Edit3 size={15} />
                    </button>

                    <button
                      onClick={() => handleDeleteTemplate(template)}
                      className="btn btn-danger"
                      style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                      title="حذف القالب"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Modal */}
      <Modal
        isOpen={isEditorOpen}
        onClose={handleCloseEditor}
        title={editingTemplate ? `تعديل القالب: ${editingTemplate.name}` : 'إنشاء قالب مستند جديد'}
      >
        <TemplateEditor
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onCancel={handleCloseEditor}
        />
      </Modal>

      {/* Generator Modal */}
      {isGeneratorOpen && generatingTemplate && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          backgroundColor: 'rgba(11, 17, 32, 0.92)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          overflowY: 'auto'
        }}>
          <div style={{ maxWidth: '1300px', width: '100%', margin: '0 auto' }}>
            <TemplateGenerator
              initialTemplate={generatingTemplate}
              templates={templates}
              onClose={handleCloseGenerator}
            />
          </div>
        </div>
      )}

    </div>
  );
}
