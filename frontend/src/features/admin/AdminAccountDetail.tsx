import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface AccountDetail {
  id: number;
  name: string;
  subscription_tier: string;
  owner_id: number;
  is_active: boolean;
  user_count: number;
  device_count: number;
  created_at: string;
}

interface AccountUser {
  id: number;
  username: string;
  email: string;
  role: string;
  created_at: string;
}

interface AccountDevice {
  id: number;
  device_id: string;
  name: string;
  type: string;
  status: string;
}

const roleColors: Record<string, string> = {
  account_owner: 'bg-red-100 text-red-700',
  farm_manager: 'bg-yellow-100 text-yellow-700',
  operator: 'bg-blue-100 text-blue-700',
  technician: 'bg-green-100 text-green-700',
  admin: 'bg-purple-100 text-purple-700',
  viewer: 'bg-gray-100 text-gray-700',
};

export default function AdminAccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [users, setUsers] = useState<AccountUser[]>([]);
  const [devices, setDevices] = useState<AccountDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    loadDetail();
  }, [id]);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/accounts/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAccount(data.account || null);
        setUsers(data.users || []);
        setDevices(data.devices || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-12 text-center text-sm text-text-muted">Loading...</div>
    );
  }

  if (!account) {
    return (
      <div className="max-w-5xl mx-auto py-12 text-center">
        <p className="text-sm text-text-muted">Account not found</p>
        <button onClick={() => navigate('/admin/accounts')} className="mt-4 text-sm text-accent hover:underline">
          Back to accounts
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back button */}
      <button onClick={() => navigate('/admin/accounts')} className="text-sm text-accent hover:underline">
        ← Back to Accounts
      </button>

      {/* Account info */}
      <div className="rounded-lg border border-border-default bg-surface-card p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-text-primary">{account.name}</h1>
            <p className="text-xs text-text-muted mt-0.5">ID: {account.id} · Created {new Date(account.created_at).toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              account.subscription_tier === 'enterprise' ? 'bg-purple-100 text-purple-700' :
              account.subscription_tier === 'professional' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {account.subscription_tier}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              account.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {account.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border-default">
          <div>
            <span className="text-xs text-text-muted block">Users</span>
            <span className="text-lg font-bold text-text-primary">{account.user_count}</span>
          </div>
          <div>
            <span className="text-xs text-text-muted block">Devices</span>
            <span className="text-lg font-bold text-text-primary">{account.device_count}</span>
          </div>
        </div>
      </div>

      {/* Users */}
      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        <div className="p-4 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary">Team Members ({users.length})</h2>
        </div>
        {users.length === 0 ? (
          <div className="p-6 text-center text-sm text-text-muted">No users</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-base text-left">
                <th className="px-4 py-3 text-text-muted font-medium">Username</th>
                <th className="px-4 py-3 text-text-muted font-medium">Email</th>
                <th className="px-4 py-3 text-text-muted font-medium">Role</th>
                <th className="px-4 py-3 text-text-muted font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border-default">
                  <td className="px-4 py-3 text-text-primary font-medium">{u.username}</td>
                  <td className="px-4 py-3 text-text-secondary">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColors[u.role] || 'bg-gray-100 text-gray-700'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Devices */}
      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        <div className="p-4 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary">Devices ({devices.length})</h2>
        </div>
        {devices.length === 0 ? (
          <div className="p-6 text-center text-sm text-text-muted">No devices</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-base text-left">
                <th className="px-4 py-3 text-text-muted font-medium">Device ID</th>
                <th className="px-4 py-3 text-text-muted font-medium">Name</th>
                <th className="px-4 py-3 text-text-muted font-medium">Type</th>
                <th className="px-4 py-3 text-text-muted font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="border-t border-border-default">
                  <td className="px-4 py-3 text-text-primary font-mono text-xs">{d.device_id}</td>
                  <td className="px-4 py-3 text-text-primary">{d.name}</td>
                  <td className="px-4 py-3 text-text-secondary">{d.type}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${d.status === 'online' ? 'text-green-600' : 'text-red-600'}`}>
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
