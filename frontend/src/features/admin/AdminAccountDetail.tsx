import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';

interface AccountDetail {
  id: number;
  name: string;
  subscription_tier: string;
  owner_id: number;
  is_active: boolean;
  max_users: number | null;
  max_devices: number | null;
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

  // Edit dialog state
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTier, setEditTier] = useState('basic');
  const [editActive, setEditActive] = useState(true);
  const [editMaxUsers, setEditMaxUsers] = useState('');
  const [editMaxDevices, setEditMaxDevices] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Add user dialog state
  const [showAddUser, setShowAddUser] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState('operator');
  const [addUserError, setAddUserError] = useState('');
  const [addUserSaving, setAddUserSaving] = useState(false);

  // Remove user confirmation
  const [removeTarget, setRemoveTarget] = useState<{ id: number; name: string } | null>(null);
  const [removeSaving, setRemoveSaving] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => { loadDetail(); }, [id]);

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

  const openEdit = () => {
    if (!account) return;
    setEditName(account.name);
    setEditTier(account.subscription_tier);
    setEditActive(account.is_active);
    setEditMaxUsers(account.max_users?.toString() || '');
    setEditMaxDevices(account.max_devices?.toString() || '');
    setEditError('');
    setShowEdit(true);
  };

  const saveEdit = async () => {
    setEditSaving(true);
    setEditError('');
    try {
      const body: Record<string, unknown> = { name: editName, subscription_tier: editTier, is_active: editActive };
      const mu = parseInt(editMaxUsers);
      const md = parseInt(editMaxDevices);
      if (!isNaN(mu)) body.max_users = mu;
      if (!isNaN(md)) body.max_devices = md;

      const res = await fetch(`/api/v1/admin/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowEdit(false);
        await loadDetail();
      } else {
        const data = await res.json();
        setEditError(data.error || 'Failed to save');
      }
    } catch {
      setEditError('Network error');
    }
    setEditSaving(false);
  };

  const userLimit = account?.max_users ?? 0;
  const deviceLimit = account?.max_devices ?? 0;
  const userPct = userLimit > 0 ? Math.round((account!.user_count / userLimit) * 100) : 0;
  const devicePct = deviceLimit > 0 ? Math.round((account!.device_count / deviceLimit) * 100) : 0;

  const openAddUser = () => {
    setAddUsername(''); setAddEmail(''); setAddPassword(''); setAddRole('operator'); setAddUserError(''); setShowAddUser(true);
  };

  const handleAddUser = async () => {
    setAddUserSaving(true); setAddUserError('');
    try {
      const res = await fetch(`/api/v1/admin/accounts/${id}/users`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: addUsername, email: addEmail, password: addPassword, role: addRole }),
      });
      if (res.ok) { setShowAddUser(false); await loadDetail(); }
      else { const d = await res.json(); setAddUserError(d.error || 'Failed'); }
    } catch { setAddUserError('Network error'); }
    setAddUserSaving(false);
  };

  const confirmRemoveUser = (uid: number, uname: string) => setRemoveTarget({ id: uid, name: uname });

  const handleRemoveUser = async () => {
    if (!removeTarget) return;
    setRemoveSaving(true);
    try {
      await fetch(`/api/v1/admin/accounts/${id}/users/${removeTarget.id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` },
      });
      setRemoveTarget(null); await loadDetail();
    } catch { /* ignore */ }
    setRemoveSaving(false);
  };

  if (loading) {
    return <div className="max-w-5xl mx-auto py-12 text-center text-sm text-text-muted">Loading...</div>;
  }

  if (!account) {
    return (
      <div className="max-w-5xl mx-auto py-12 text-center">
        <p className="text-sm text-text-muted">Account not found</p>
        <button onClick={() => navigate('/admin/accounts')} className="mt-4 text-sm text-accent hover:underline">Back to accounts</button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <button onClick={() => navigate('/admin/accounts')} className="text-sm text-accent hover:underline">← Back to Accounts</button>

      {/* Account info + Edit button */}
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
            }`}>{account.subscription_tier}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${account.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {account.is_active ? 'Active' : 'Inactive'}
            </span>
            <button onClick={openEdit} className="text-xs px-3 py-1.5 rounded-md border border-border-default text-text-secondary hover:bg-surface-hover transition-colors">Edit</button>
          </div>
        </div>

        {/* Quota bars */}
        <div className="grid grid-cols-2 gap-6 mt-4 pt-4 border-t border-border-default">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-text-muted">Users</span>
              <span className="text-text-primary font-medium">{account.user_count} / {userLimit}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${userPct >= 90 ? 'bg-red-500' : userPct >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(userPct, 100)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-text-muted">Devices</span>
              <span className="text-text-primary font-medium">{account.device_count} / {deviceLimit}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${devicePct >= 90 ? 'bg-red-500' : devicePct >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(devicePct, 100)}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Users table */}
      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        <div className="p-4 border-b border-border-default flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Team Members ({users.length})</h2>
          <button onClick={openAddUser} className="text-xs px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover transition-colors">Add User</button>
        </div>
        {users.length === 0 ? (<div className="p-6 text-center text-sm text-text-muted">No users</div>) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-base text-left">
                <th className="px-4 py-3 text-text-muted font-medium">Username</th>
                <th className="px-4 py-3 text-text-muted font-medium">Email</th>
                <th className="px-4 py-3 text-text-muted font-medium">Role</th>
                <th className="px-4 py-3 text-text-muted font-medium">Joined</th>
                <th className="px-4 py-3 text-text-muted font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border-default">
                  <td className="px-4 py-3 text-text-primary font-medium">{u.username}</td>
                  <td className="px-4 py-3 text-text-secondary">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColors[u.role] || 'bg-gray-100 text-gray-700'}`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => confirmRemoveUser(u.id, u.username)} className="text-xs text-red-600 hover:text-red-700 transition-colors">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Devices table */}
      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        <div className="p-4 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary">Devices ({devices.length})</h2>
        </div>
        {devices.length === 0 ? (<div className="p-6 text-center text-sm text-text-muted">No devices</div>) : (
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
                    <span className={`text-xs font-medium ${d.status === 'online' ? 'text-green-600' : 'text-red-600'}`}>{d.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add user dialog */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAddUser(false)}>
          <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-text-primary">Add User to Account</h2>
            {addUserError && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{addUserError}</div>}
            <div>
              <label className="text-xs text-text-muted block mb-1">Username</label>
              <input value={addUsername} onChange={e => setAddUsername(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border-default text-sm" />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Email</label>
              <input type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border-default text-sm" />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Password</label>
              <input type="password" value={addPassword} onChange={e => setAddPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border-default text-sm" />
            </div>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ color: '#9ca3af', '&.Mui-focused': { color: '#2e7d32' } }}>Role</InputLabel>
              <Select value={addRole} onChange={e => setAddRole(e.target.value)} label="Role">
                <MenuItem value="account_owner">Account Owner</MenuItem>
                <MenuItem value="farm_manager">Farm Manager</MenuItem>
                <MenuItem value="operator">Operator</MenuItem>
                <MenuItem value="technician">Technician</MenuItem>
              </Select>
            </FormControl>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAddUser(false)} className="px-4 py-2 text-sm rounded-lg border border-border-default text-text-secondary hover:bg-surface-hover">Cancel</button>
              <button onClick={handleAddUser} disabled={addUserSaving} className="px-4 py-2 text-sm rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-50">
                {addUserSaving ? 'Adding...' : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove user confirmation */}
      {removeTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setRemoveTarget(null)}>
          <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-text-primary">Remove User</h2>
            <p className="text-sm text-text-secondary">Remove <strong>{removeTarget.name}</strong> from this account?</p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setRemoveTarget(null)} className="px-4 py-2 text-sm rounded-lg border border-border-default text-text-secondary hover:bg-surface-hover">Cancel</button>
              <button onClick={handleRemoveUser} disabled={removeSaving} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                {removeSaving ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit dialog */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowEdit(false)}>
          <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-text-primary">Edit Account</h2>
            {editError && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{editError}</div>}

            <div>
              <label className="text-xs text-text-muted block mb-1">Account Name</label>
              <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border-default text-sm focus:outline-none focus:border-accent" />
            </div>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ color: '#9ca3af', '&.Mui-focused': { color: '#2e7d32' } }}>Subscription Tier</InputLabel>
              <Select value={editTier} onChange={e => setEditTier(e.target.value)} label="Subscription Tier">
                <MenuItem value="basic">Basic</MenuItem>
                <MenuItem value="professional">Professional</MenuItem>
                <MenuItem value="enterprise">Enterprise</MenuItem>
              </Select>
            </FormControl>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editActive} onChange={e => setEditActive(e.target.checked)} className="rounded" />
                <span className="text-sm text-text-primary">Active</span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-muted block mb-1">Max Users</label>
                <input type="number" min="1" value={editMaxUsers} onChange={e => setEditMaxUsers(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border-default text-sm focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Max Devices</label>
                <input type="number" min="1" value={editMaxDevices} onChange={e => setEditMaxDevices(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border-default text-sm focus:outline-none focus:border-accent" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowEdit(false)} className="px-4 py-2 text-sm rounded-lg border border-border-default text-text-secondary hover:bg-surface-hover transition-colors">Cancel</button>
              <button onClick={saveEdit} disabled={editSaving} className="px-4 py-2 text-sm rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors">
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
