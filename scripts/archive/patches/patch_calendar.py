import re

with open('client/src/components/Calendar/Calendar.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

handle_export_new = """
  const handleExport = async () => {
    try {
      let url = `/exports/events?format=${exportFormat}`;
      if (exportWeek !== 'all') {
        url += `&week=${exportWeek}`;
      }

      const res = await apiFetch(url);
      
      if (!res.ok) throw new Error('Export failed');
      
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = downloadUrl;
      a.download = `events_${exportWeek}.${exportFormat === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      setIsExportModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء التصدير');
    }
  };
"""

content = re.sub(
    r'const handleExport = async \(\) => \{.*?catch \(err\) \{[^}]+\}\s*\};\s*',
    handle_export_new.strip() + "\\n\\n",
    content,
    flags=re.DOTALL
)

with open('client/src/components/Calendar/Calendar.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

