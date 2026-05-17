import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface AuditEntry {
  id: number;
  account_id: number;
  user_id: number | null;
  action: string;
  resource_type: string;
  resource_name: string;
  status: string;
  created_at: string;
}

const actionColors: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  read: 'bg-blue-100 text-blue-700',
  update: 'bg-yellow-100 text-yellow-700',
  delete: 'bg-red-100 text-red-700',
};

export default function AdminAuditLog() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [resourceType, setResourceType] = useState('');
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 25;
  const token = localStorage.getItem('token');

  useEffect(() => {
    loadLogs();
  }, [page, resourceType, action]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
      if (resourceType) params.append('resource_type', resourceType);
      if (action) params.append('action', action);

      const res = await fetch(`/api/v1/admin/audit?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold text-text-primary">{t('auditLog.globalTitle')}</h1>
        <p className="text-sm text-text-muted mt-0.5">{t('auditLog.globalSubtitle')}</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={resourceType}
          onChange={e => { setResourceType(e.target.value); setPage(0); }}
          className="px-3 py-1.5 text-xs rounded-lg border border-border-default bg-surface-card text-text-primary"
        >
          <option value="">{t('auditLog.allResources')}</option>
          <option value="user">{t('auditLog.resourceUser')}</option>
          <option value="device">{t('auditLog.resourceDevice')}</option>
          <option value="alert">{t('auditLog.resourceAlert')}</option>
          <option value="farm">{t('auditLog.resourceFarm')}</option>
          <option value="user_invitation">{t('auditLog.resourceInvitation')}</option>
          <option value="user_permission">{t('auditLog.resourcePermission')}</option>
        </select>
        <select
          value={action}
          onChange={e => { setAction(e.target.value); setPage(0); }}
          className="px-3 py-1.5 text-xs rounded-lg border border-border-default bg-surface-card text-text-primary"
        >
          <option value="">{t('auditLog.allActions')}</option>
          <option value="create">{t('auditLog.actionCreate')}</option>
          <option value="read">{t('auditLog.actionRead')}</option>
          <option value="update">{t('auditLog.actionUpdate')}</option>
          <option value="delete">{t('auditLog.actionDelete')}</option>
        </select>
        {(resourceType || action) && (
          <button
            onClick={() => { setResourceType(''); setAction(''); setPage(0); }}
            className="px-3 py-1.5 text-xs rounded-lg border border-border-default text-text-secondary hover:bg-surface-hover transition-colors"
          >
            {t('common.reset')}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-text-muted">{t('common.loading')}</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">{t('auditLog.noLogs')}</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-base text-left">
                  <th className="px-4 py-3 text-text-muted font-medium">{t('auditLog.account')}</th>
                  <th className="px-4 py-3 text-text-muted font-medium">{t('auditLog.user')}</th>
                  <th className="px-4 py-3 text-text-muted font-medium">{t('auditLog.action')}</th>
                  <th className="px-4 py-3 text-text-muted font-medium">{t('auditLog.resource')}</th>
                  <th className="px-4 py-3 text-text-muted font-medium">{t('auditLog.name')}</th>
                  <th className="px-4 py-3 text-text-muted font-medium">{t('common.status')}</th>
                  <th className="px-4 py-3 text-text-muted font-medium">{t('auditLog.timestamp')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-border-default">
                    <td className="px-4 py-3 text-text-muted">#{log.account_id}</td>
                    <td className="px-4 py-3 text-text-secondary">{log.user_id ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${actionColors[log.action] || 'bg-gray-100 text-gray-700'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{log.resource_type}</td>
                    <td className="px-4 py-3 text-text-primary">{log.resource_name || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${log.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-between px-4 py-3 border-t border-border-default">
              <span className="text-xs text-text-muted">{t('auditLog.pagination', { current: page + 1, total: totalPages || 1 })}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page <= 0}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-border-default text-text-secondary hover:bg-surface-hover disabled:opacity-40 transition-colors">{t('common.previous')}</button>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-border-default text-text-secondary hover:bg-surface-hover disabled:opacity-40 transition-colors">{t('common.next')}</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
