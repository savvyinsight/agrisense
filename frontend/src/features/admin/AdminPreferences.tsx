import { useState, useEffect } from 'react';

interface PageOption {
  key: string;
  label: string;
  path: string;
}

const allPages: PageOption[] = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { key: 'fields', label: 'Fields', path: '/fields' },
  { key: 'alerts', label: 'Alerts', path: '/alerts' },
  { key: 'irrigation', label: 'Irrigation', path: '/irrigation' },
  { key: 'analytics', label: 'Analytics', path: '/analytics' },
  { key: 'reports', label: 'Reports', path: '/reports' },
  { key: 'devices', label: 'Devices', path: '/devices' },
  { key: 'alertRules', label: 'Alert Rules', path: '/alert-rules' },
  { key: 'automation', label: 'Automation', path: '/automation' },
  { key: 'team', label: 'Team', path: '/settings/team' },
  { key: 'settings', label: 'Settings', path: '/settings' },
  { key: 'adminAccounts', label: 'Accounts (Admin)', path: '/admin/accounts' },
  { key: 'adminAudit', label: 'Audit Log (Admin)', path: '/admin/audit' },
];

const STORAGE_KEY = 'admin_hidden_pages';

function loadHidden(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHidden(paths: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
}

export default function AdminPreferences() {
  const [hidden, setHidden] = useState<string[]>(loadHidden);

  useEffect(() => { saveHidden(hidden); }, [hidden]);

  const toggle = (path: string) => {
    setHidden(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold text-text-primary">Page Visibility</h1>
        <p className="text-sm text-text-muted mt-0.5">Toggle which pages appear in your sidebar</p>
      </div>

      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        <div className="p-4 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary">Sidebar Pages</h2>
        </div>
        <div className="divide-y divide-border-default">
          {allPages.map(page => {
            const isHidden = hidden.includes(page.path);
            return (
              <div key={page.path} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="text-sm text-text-primary">{page.label}</span>
                  <span className="text-xs text-text-muted ml-2">{page.path}</span>
                </div>
                <button
                  onClick={() => toggle(page.path)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${isHidden ? 'bg-gray-300' : 'bg-accent'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isHidden ? '' : 'translate-x-5'}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-xs text-text-muted">
        Hidden pages: {hidden.length === 0 ? 'none' : hidden.join(', ')}
      </div>
    </div>
  );
}
