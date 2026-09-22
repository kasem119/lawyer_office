import React from 'react';
import { Filter, Search, RotateCcw } from 'lucide-react';

export default function ActivityFilters({
  searchQuery,
  setSearchQuery,
  userIdFilter,
  setUserIdFilter,
  entityTypeFilter,
  setEntityTypeFilter,
  actionFilter,
  setActionFilter,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  users,
  onSearchSubmit,
  onResetFilters
}) {
  return (
    <div className="glass-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: '700', fontSize: '0.95rem' }}>
        <Filter size={18} />
        <span>تصفية وفلترة السجل</span>
      </div>

      <form onSubmit={onSearchSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'flex-end' }}>
        {/* Search text */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.82rem' }}>بحث بالنص أو المحتوى:</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              style={{ width: '100%', paddingRight: '34px', fontSize: '0.88rem' }}
              placeholder="بحث في تفاصيل الإجراء..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={16} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>
        </div>

        {/* User selector */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.82rem' }}>المستخدم:</label>
          <select
            className="form-select"
            style={{ width: '100%', fontSize: '0.88rem' }}
            value={userIdFilter}
            onChange={(e) => setUserIdFilter(e.target.value)}
          >
            <option value="all">كل المستخدمين</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role === 'admin' ? 'مدير' : 'محامي'})
              </option>
            ))}
          </select>
        </div>

        {/* Entity Type selector */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.82rem' }}>نوع الكيان:</label>
          <select
            className="form-select"
            style={{ width: '100%', fontSize: '0.88rem' }}
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
          >
            <option value="all">كل الكيانات</option>
            <option value="case">قضية (Case)</option>
            <option value="client">عميل (Client)</option>
            <option value="document">مستند (Document)</option>
            <option value="invoice">فاتورة (Invoice)</option>
            <option value="task">مهمة (Task)</option>
            <option value="event">موعد / جلسة (Event)</option>
            <option value="user">مستخدم / محامي (User)</option>
            <option value="expense">مصروف (Expense)</option>
            <option value="time_entry">تتبع وقت (Time Entry)</option>
            <option value="case_note">ملاحظة قضية (Note)</option>
            <option value="backup">نسخة احتياطية (Backup)</option>
            <option value="conflict">تعارض مصالح (Conflict)</option>
          </select>
        </div>

        {/* Action Type selector */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.82rem' }}>نوع العملية:</label>
          <select
            className="form-select"
            style={{ width: '100%', fontSize: '0.88rem' }}
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="all">كل العمليات</option>
            <option value="create">إنشاء (Create)</option>
            <option value="update">تعديل (Update)</option>
            <option value="delete">حذف (Delete)</option>
            <option value="login">تسجيل دخول (Login)</option>
            <option value="view">عرض / استعراض (View)</option>
            <option value="send_email">إرسال بريد (Send Email)</option>
            <option value="backup">نسخ احتياطي (Backup)</option>
          </select>
        </div>

        {/* From Date */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.82rem' }}>من تاريخ:</label>
          <input
            type="date"
            className="form-input"
            style={{ width: '100%', fontSize: '0.88rem' }}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        {/* To Date */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.82rem' }}>إلى تاريخ:</label>
          <input
            type="date"
            className="form-input"
            style={{ width: '100%', fontSize: '0.88rem' }}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={onResetFilters}
            className="btn btn-secondary"
            title="إعادة تعيين الفلاتر"
            style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem' }}
          >
            <RotateCcw size={15} />
            إعادة ضبط
          </button>
        </div>
      </form>
    </div>
  );
}
