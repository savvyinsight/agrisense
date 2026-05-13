import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAlertsStore } from '@/shared/stores/alertsStore';
import { cn } from '@/shared/lib/cn';

const tabs = [
  { path: '/dashboard', icon: '⊞', labelKey: 'nav.dashboard' },
  { path: '/fields', icon: '⏹', labelKey: 'nav.fields' },
  { path: '/alerts', icon: '⚡', labelKey: 'nav.alerts', badge: true },
  { path: '/irrigation', icon: '💧', labelKey: 'nav.irrigation' },
  { path: '/weather', icon: '☀', labelKey: 'nav.weather' },
];

export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const activeCount = useAlertsStore((s) => s.activeCount);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-surface-card border-t border-border-default">
      <div className="flex items-center justify-around h-16 safe-area-bottom">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[48px] px-2 rounded-md transition-colors relative',
                isActive ? 'text-accent' : 'text-text-muted hover:text-text-secondary',
              )}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              <span className="text-[10px] font-medium leading-tight">{t(tab.labelKey)}</span>
              {tab.badge && activeCount > 0 && (
                <span className="absolute -top-0.5 right-1/4 min-w-[18px] h-[18px] bg-critical text-[10px] font-bold text-white rounded-full flex items-center justify-center px-1">
                  {activeCount > 9 ? '9+' : activeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
