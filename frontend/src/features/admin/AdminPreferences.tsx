import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface PageOption {
  key: string;
  label: string;
  path: string;
}

const pageConfigs: Omit<PageOption, 'label'>[] = [
  { key: 'dashboard', path: '/dashboard' },
  { key: 'fields', path: '/fields' },
  { key: 'alerts', path: '/alerts' },
  { key: 'irrigation', path: '/irrigation' },
  { key: 'analytics', path: '/analytics' },
  { key: 'reports', path: '/reports' },
  { key: 'devices', path: '/devices' },
  { key: 'alertRules', path: '/alert-rules' },
  { key: 'automation', path: '/automation' },
  { key: 'team', path: '/settings/team' },
  { key: 'settings', path: '/settings' },
  { key: 'adminAccounts', path: '/admin/accounts' },
  { key: 'adminAudit', path: '/admin/audit' },
];

const navKeyMap: Record<string, string> = {
  dashboard: 'nav.dashboard',
  fields: 'nav.fields',
  alerts: 'nav.alerts',
  irrigation: 'nav.irrigation',
  analytics: 'nav.analytics',
  reports: 'nav.reports',
  devices: 'nav.devices',
  alertRules: 'nav.alertRules',
  automation: 'nav.automation',
  team: 'nav.team',
  settings: 'nav.settings',
  adminAccounts: 'nav.adminAccounts',
  adminAudit: 'nav.adminAudit',
};

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
  const { t } = useTranslation();
  const [hidden, setHidden] = useState<string[]>(loadHidden);

  const allPages: PageOption[] = useMemo(
    () => pageConfigs.map(p => ({ ...p, label: t(navKeyMap[p.key]) })),
    [t]
  );

  useEffect(() => { saveHidden(hidden); }, [hidden]);

  const toggle = (path: string) => {
    setHidden(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold text-text-primary">{t('admin.pageVisibility')}</h1>
        <p className="text-sm text-text-muted mt-0.5">{t('admin.togglePages')}</p>
      </div>

      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        <div className="p-4 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary">{t('admin.sidebarPages')}</h2>
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
        {t('admin.hiddenPages', { pages: hidden.length === 0 ? t('common.no') : hidden.join(', ') })}
      </div>
    </div>
  );
}
