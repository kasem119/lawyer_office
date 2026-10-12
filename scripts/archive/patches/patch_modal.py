import re

with open('client/src/components/Cases/CaseDetails.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

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

content = content.replace('<Modal isOpen={isEditModalOpen}', modal_str + '\\n      <Modal isOpen={isEditModalOpen}')

with open('client/src/components/Cases/CaseDetails.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

