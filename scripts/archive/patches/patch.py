import re

with open('client/src/components/Cases/CaseDetails.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

state_vars = """
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCloseCaseModalOpen, setIsCloseCaseModalOpen] = useState(false);
  const [targetCloseStatus, setTargetCloseStatus] = useState('closed');
  const [closeNote, setCloseNote] = useState('');
  const [closeFile, setCloseFile] = useState(null);
  const [closeLoading, setCloseLoading] = useState(false);
"""
content = re.sub(r'const \[isEditModalOpen, setIsEditModalOpen\] = useState\(false\);', state_vars.strip(), content)

handle_status_str = """
  const handleStatusChange = async (newStatus) => {
    if (newStatus === 'closed' || newStatus === 'archived') {
      const pendingTasks = data?.tasks?.filter(t => t.status !== 'done');
      if (pendingTasks && pendingTasks.length > 0) {
        alert('لا يمكن إغلاق أو أرشفة القضية لوجود مهام غير منجزة مرتبط بها.');
        return;
      }
      const upcomingEvents = data?.events?.filter(e => new Date(e.date) >= new Date(new Date().toISOString().split('T')[0]));
      if (upcomingEvents && upcomingEvents.length > 0) {
        alert('لا يمكن إغلاق أو أرشفة القضية لوجود جلسات أو مواعيد قادمة.');
        return;
      }
      setTargetCloseStatus(newStatus);
      setCloseNote('');
      setCloseFile(null);
      setIsCloseCaseModalOpen(true);
      return;
    }
    await executeStatusChange(newStatus);
  };

  const executeStatusChange = async (newStatus) => {
    try {
      const res = await apiFetch(/cases//status, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchDetails();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'حدث خطأ أثناء تغيير الحالة');
      }
    } catch (err) {
      alert(err.message || 'حدث خطأ أثناء تغيير الحالة');
    }
  };

  const submitCloseCase = async (e) => {
    e.preventDefault();
    setCloseLoading(true);
    try {
      if (closeFile) {
        const formData = new FormData();
        formData.append('document', closeFile);
        formData.append('case_id', caseId);

        const uploadRes = await apiFetch('/documents', {
          method: 'POST',
          body: formData
        });
        if (!uploadRes.ok) {
           const err = await uploadRes.json().catch(()=>({}));
           throw new Error(err.message || 'فشل رفع المستند');
        }
      }

      if (closeNote.trim()) {
        const noteRes = await apiFetch(/cases//notes, {
          method: 'POST',
          body: JSON.stringify({ content: closeNote, note_type: 'court_result', is_private: 0 })
        });
        if (!noteRes.ok) {
           const err = await noteRes.json().catch(()=>({}));
           throw new Error(err.message || 'فشل إضافة الملاحظة');
        }
      }

      await executeStatusChange(targetCloseStatus);
      setIsCloseCaseModalOpen(false);
    } catch (err) {
      alert(err.message || 'حدث خطأ أثناء إغلاق القضية');
    } finally {
      setCloseLoading(false);
    }
  };
"""

content = re.sub(
    r'const handleStatusChange = async \(newStatus\) => \{.*?catch \(err\) \{[^}]+\}\s*\};\s*',
    handle_status_str.strip() + "\\n\\n",
    content,
    flags=re.DOTALL
)

toggle_done = """
  const handleToggleDone = async () => {
    if (caseItem.status === 'closed') {
      const msg = 'هل تريد إعادة فتح القضية وجعلها نشطة؟';
      if (!window.confirm(msg)) return;
      await executeStatusChange('active');
    } else {
      handleStatusChange('closed');
    }
  };
"""

content = re.sub(
    r'const handleToggleDone = async \(\) => \{.*?\};\s*',
    toggle_done.strip() + "\\n\\n",
    content,
    flags=re.DOTALL
)

modal_str = """
      {isCloseCaseModalOpen && (
        <Modal title={targetCloseStatus === 'closed' ? "إتمام القضية" : "أرشفة القضية"} onClose={() => setIsCloseCaseModalOpen(false)}>
          <form onSubmit={submitCloseCase} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="form-label">الحكم النهائي / ملاحظات الإغلاق</label>
              <textarea
                className="form-input"
                rows="4"
                value={closeNote}
                onChange={e => setCloseNote(e.target.value)}
                placeholder="اكتب خلاصة الحكم أو أي ملاحظات نهائية..."
              ></textarea>
            </div>
            <div>
              <label className="form-label">إدراج الحكم النهائي (مستند أو صورة) اختياري</label>
              <input
                type="file"
                className="form-input"
                onChange={e => setCloseFile(e.target.files[0])}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <Button variant="secondary" type="button" onClick={() => setIsCloseCaseModalOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={closeLoading}>
                {closeLoading ? 'جاري الحفظ...' : 'تأكيد وحفظ'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
"""

content = content.replace('{isEditModalOpen && (', modal_str + '\\n      {isEditModalOpen && (')

with open('client/src/components/Cases/CaseDetails.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
