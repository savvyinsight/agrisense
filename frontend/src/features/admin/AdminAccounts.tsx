import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface AccountRow {
  id: number;
  name: string;
  subscription_tier: string;
  owner_name: string;
  user_count: number;
  device_count: number;
  is_active: boolean;
  created_at: string;
}

interface Stats {
  total_accounts: number;
  total_users: number;
  total_devices: number;
}

export default function AdminAccounts() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;
  const token = localStorage.getItem('token');

  useEffect(() => {
    loadStats();
    loadAccounts();
  }, [page]);

  const loadStats = async () => {
    try {
      const res = await fetch('/api/v1/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
  };

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/accounts?page=${page}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
        setTotal(data.total || 0);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold text-text-primary">Platform Admin</h1>
        <p className="text-sm text-text-muted mt-0.5">Manage all farm accounts</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border-default bg-surface-card p-4">
          <span className="text-xs text-text-muted block">Total Accounts</span>
          <span className="text-2xl font-bold text-text-primary">{stats?.total_accounts ?? '-'}</span>
        </div>
        <div className="rounded-lg border border-border-default bg-surface-card p-4">
          <span className="text-xs text-text-muted block">Total Users</span>
          <span className="text-2xl font-bold text-text-primary">{stats?.total_users ?? '-'}</span>
        </div>
        <div className="rounded-lg border border-border-default bg-surface-card p-4">
          <span className="text-xs text-text-muted block">Total Devices</span>
          <span className="text-2xl font-bold text-text-primary">{stats?.total_devices ?? '-'}</span>
        </div>
      </div>

      {/* Accounts table */}
      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        <div className="p-4 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary">All Accounts ({total})</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-text-muted">Loading...</div>
        ) : accounts.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">No accounts found</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-base text-left">
                  <th className="px-4 py-3 text-text-muted font-medium">Name</th>
                  <th className="px-4 py-3 text-text-muted font-medium">Tier</th>
                  <th className="px-4 py-3 text-text-muted font-medium">Owner</th>
                  <th className="px-4 py-3 text-text-muted font-medium text-right">Users</th>
                  <th className="px-4 py-3 text-text-muted font-medium text-right">Devices</th>
                  <th className="px-4 py-3 text-text-muted font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => (
                  <tr
                    key={acc.id}
                    onClick={() => navigate(`/admin/accounts/${acc.id}`)}
                    className="border-t border-border-default hover:bg-surface-hover cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-text-primary font-medium">{acc.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        acc.subscription_tier === 'enterprise' ? 'bg-purple-100 text-purple-700' :
                        acc.subscription_tier === 'professional' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {acc.subscription_tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{acc.owner_name || '-'}</td>
                    <td className="px-4 py-3 text-text-primary text-right">{acc.user_count}</td>
                    <td className="px-4 py-3 text-text-primary text-right">{acc.device_count}</td>
                    <td className="px-4 py-3 text-text-muted text-xs">
                      {new Date(acc.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border-default">
              <span className="text-xs text-text-muted">
                Page {page} of {totalPages || 1}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-border-default text-text-secondary hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-border-default text-text-secondary hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
