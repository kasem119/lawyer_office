import re

with open('client/src/components/Cases/CaseList.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

handle_toggle_done_new = """
  const handleToggleStatus = async (caseItem) => {
    if (caseItem.status !== 'closed') {
      alert('لإتمام أو أرشفة القضية، يرجى الدخول إلى تفاصيل القضية وتدوين الحكم النهائي.');
      onViewCase(caseItem.id);
      return;
    }

    const msg = 'هل تريد إعادة فتح القضية وجعلها نشطة؟';
    if (!window.confirm(msg)) return;

    try {
      const res = await apiFetch(`/cases/${caseItem.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'active' })
      });
      if (res.ok) {
        fetchCases();
      } else {
        const err = await res.json().catch(()=>({}));
        alert(err.message || 'حدث خطأ');
      }
    } catch (e) {
      alert('حدث خطأ');
    }
  };
"""

content = re.sub(
    r'const handleToggleStatus = async \(caseItem\) => \{.*?catch \([^\)]+\) \{[^}]+\}\s*\};\s*',
    handle_toggle_done_new.strip() + "\\n\\n",
    content,
    flags=re.DOTALL
)

with open('client/src/components/Cases/CaseList.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
