import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { useAuthStore } from '@/shared/stores/authStore';

interface NavItem { label: string; path: string; icon: string; adminOnly?: boolean; platformOnly?: boolean; bottom?: boolean }

const navItems: NavItem[] = [
  { label: 'nav.dashboard', path: '/dashboard', icon: '⊞' },
  { label: 'nav.fields', path: '/fields', icon: '⏹' },
  { label: 'nav.alerts', path: '/alerts', icon: '⚡' },
  { label: 'nav.irrigation', path: '/irrigation', icon: '💧' },
  { label: 'nav.map', path: '/map', icon: '🗺' },
  { label: 'nav.analytics', path: '/analytics', icon: '📊' },
  { label: 'nav.reports', path: '/reports', icon: '📋' },
  { label: 'nav.team', path: '/settings/team', icon: '👥' },
  { label: 'nav.audit', path: '/settings/audit', icon: '📋', adminOnly: true },
  { label: 'nav.adminAccounts', path: '/admin/accounts', icon: '🏛', platformOnly: true },
  { label: 'nav.adminAudit', path: '/admin/audit', icon: '📋', platformOnly: true },
  { label: 'nav.adminPreferences', path: '/admin/preferences', icon: '⚙', platformOnly: true },
  { label: 'nav.devices', path: '/devices', icon: '📡', adminOnly: true },
  { label: 'nav.alertRules', path: '/alert-rules', icon: '⚙', adminOnly: true },
  { label: 'nav.automation', path: '/automation', icon: '🔄', adminOnly: true },
  { label: 'nav.automationDashboard', path: '/automation/dashboard', icon: '🎛', adminOnly: true },
  { label: 'nav.escalationRules', path: '/escalation-rules', icon: '🔔', adminOnly: true },
  { label: 'nav.notifications', path: '/settings/notifications', icon: '✉', adminOnly: true },
  { label: 'nav.settings', path: '/settings', icon: '⚙', bottom: true },
];

interface SidebarProps { open: boolean; onClose: () => void; isAdmin: boolean; collapsed?: boolean; onToggleCollapse?: () => void }

export function Sidebar({ open, onClose, isAdmin, collapsed = false, onToggleCollapse }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const isPlatformAdmin = user?.role === 'admin';

  // Load admin-hidden pages from localStorage
  const hiddenPages: string[] = (() => {
    try { return JSON.parse(localStorage.getItem('admin_hidden_pages') || '[]'); }
    catch { return []; }
  })();

  const visible = (item: NavItem) => {
    if (item.platformOnly && !isPlatformAdmin) return false;
    if (item.adminOnly && !isAdmin) return false;
    // Platform admin can hide pages via preferences
    if (isPlatformAdmin && hiddenPages.includes(item.path)) return false;
    return true;
  };

  const bottom = navItems.filter((item) => item.bottom && visible(item));
  const main = navItems.filter((item) => !item.bottom && visible(item));

  const handleNav = (path: string) => { navigate(path); onClose(); };

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />}
      <aside className={cn('fixed top-0 left-0 z-50 h-full bg-surface-card border-r border-border-default transform transition-all duration-200 ease-in-out md:translate-x-0 md:static md:z-auto', collapsed ? 'w-16' : 'w-64', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className={cn('flex items-center h-14 border-b border-border-default', collapsed ? 'justify-center px-0' : 'px-4')}>
          {collapsed ? (
            <span className="text-lg font-bold text-text-primary tracking-tight">A</span>
          ) : (
            <span className="text-lg font-bold text-text-primary tracking-tight">AgriSense</span>
          )}
        </div>
        <nav className="py-2 flex flex-col h-[calc(100%-7rem)]">
          <div className="flex-1">
            {main.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button key={item.path} onClick={() => handleNav(item.path)} className={cn('w-full flex items-center gap-3 min-h-[44px] text-sm transition-colors', collapsed ? 'justify-center px-0' : 'px-4', isActive ? (collapsed ? 'bg-accent/10 text-accent' : 'bg-accent/10 text-accent border-r-2 border-accent') : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover')}>
                  <span className={cn('text-base text-center', collapsed ? 'text-lg' : 'w-5')}>{item.icon}</span>
                  {!collapsed && <span>{t(item.label)}</span>}
                </button>
              );
            })}
          </div>
          <div className="border-t border-border-default pt-2">
            {bottom.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button key={item.path} onClick={() => handleNav(item.path)} className={cn('w-full flex items-center gap-3 min-h-[44px] text-sm transition-colors', collapsed ? 'justify-center px-0' : 'px-4', isActive ? (collapsed ? 'bg-accent/10 text-accent' : 'bg-accent/10 text-accent border-r-2 border-accent') : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover')}>
                  <span className={cn('text-base text-center', collapsed ? 'text-lg' : 'w-5')}>{item.icon}</span>
                  {!collapsed && <span>{t(item.label)}</span>}
                </button>
              );
            })}
          </div>
        </nav>
        <div className="border-t border-border-default hidden md:block">
          <button onClick={onToggleCollapse} className="w-full flex items-center justify-center min-h-[44px] text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors">
            <svg className={cn('w-4 h-4 transition-transform', collapsed ? 'rotate-180' : '')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </aside>
    </>
  );
}
