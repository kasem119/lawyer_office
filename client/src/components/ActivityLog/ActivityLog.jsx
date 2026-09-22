import React, { useState, useEffect, useCallback } from 'react';
import { Activity, RotateCcw } from 'lucide-react';
import { apiFetch } from '../../api/client';
import ActivityStats from './ActivityStats';
import ActivityFilters from './ActivityFilters';
import ActivityTable from './ActivityTable';
import ActivityDetailModal from './ActivityDetailModal';

export default function ActivityLog() {
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters State
  const [userIdFilter, setUserIdFilter] = useState('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selected Detail Modal
  const [detailModalItem, setDetailModalItem] = useState(null);

  // Fetch Users for Filter dropdown
  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await apiFetch('/users');
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users || []);
        }
      } catch (err) {
        console.error('Failed to load users list:', err);
      }
    }
    loadUsers();
  }, []);

  // Fetch Stats
  const fetchStats = async () => {
    try {
      const res = await apiFetch('/activities/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch activity stats:', err);
    }
  };

  // Fetch Activities with current filters & pagination
  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', limit);
      if (userIdFilter && userIdFilter !== 'all') params.append('user_id', userIdFilter);
      if (entityTypeFilter && entityTypeFilter !== 'all') params.append('entity_type', entityTypeFilter);
      if (actionFilter && actionFilter !== 'all') params.append('action', actionFilter);
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await apiFetch(`/activities?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'فشل جلب سجل النشاطات');
      }

      const data = await res.json();
      setActivities(data.activities || []);
      if (data.pagination) {
        setTotalPages(data.pagination.totalPages || 1);
        setTotalCount(data.pagination.total || 0);
      }
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء تحميل السجل');
    } finally {
      setLoading(false);
    }
  }, [page, limit, userIdFilter, entityTypeFilter, actionFilter, fromDate, toDate, searchQuery]);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleResetFilters = () => {
    setUserIdFilter('all');
    setEntityTypeFilter('all');
    setActionFilter('all');
    setFromDate('');
    setToDate('');
    setSearchQuery('');
    setPage(1);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchActivities();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={28} />
            سجل التدقيق والنشاطات (Audit Trail)
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            مراقبة وتتبع العمليات والتعديلات المنفذة في النظام مع التفاصيل الدقيقة والمستخدمين
          </p>
        </div>

        <button
          onClick={() => { fetchStats(); fetchActivities(); }}
          className="btn btn-secondary"
          style={{ fontSize: '0.88rem', padding: '8px 14px' }}
        >
          <RotateCcw size={16} />
          تحديث السجل
        </button>
      </div>

      {/* Quick Statistics Cards */}
      <ActivityStats stats={stats} />

      {/* Filters Bar */}
      <ActivityFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        userIdFilter={userIdFilter}
        setUserIdFilter={setUserIdFilter}
        entityTypeFilter={entityTypeFilter}
        setEntityTypeFilter={setEntityTypeFilter}
        actionFilter={actionFilter}
        setActionFilter={setActionFilter}
        fromDate={fromDate}
        setFromDate={setFromDate}
        toDate={toDate}
        setToDate={setToDate}
        users={users}
        onSearchSubmit={handleSearchSubmit}
        onResetFilters={handleResetFilters}
      />

      {/* Activity Log Table with Pagination */}
      <ActivityTable
        activities={activities}
        loading={loading}
        error={error}
        page={page}
        setPage={setPage}
        limit={limit}
        setLimit={setLimit}
        totalPages={totalPages}
        totalCount={totalCount}
        onSelectDetail={(item) => setDetailModalItem(item)}
      />

      {/* Details View Modal */}
      {detailModalItem && (
        <ActivityDetailModal
          item={detailModalItem}
          onClose={() => setDetailModalItem(null)}
        />
      )}
    </div>
  );
}
