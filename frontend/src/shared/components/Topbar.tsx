import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/shared/stores/authStore';
import { useAlertsStore } from '@/shared/stores/alertsStore';
import { useNavigate } from 'react-router-dom';
import AccountSelector from '@/features/auth/AccountSelector';
import RoleBadge from '@/features/auth/RoleBadge';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';

interface TopbarProps { onMenuToggle: () => void }

export function Topbar({ onMenuToggle }: TopbarProps) {
  const { t, i18n } = useTranslation();
  const { clearAuth } = useAuthStore();
  const activeCount = useAlertsStore((s) => s.activeCount);
  const navigate = useNavigate();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const handleLogoutClick = () => setLogoutOpen(true);
  const confirmLogout = () => { clearAuth(); navigate('/login'); };

  return (
    <>
      <header className="h-14 border-b border-border-default bg-surface-base flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <button onClick={onMenuToggle} className="md:hidden p-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-secondary hover:text-text-primary rounded-md hover:bg-surface-hover" aria-label={t('component.toggleMenu')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <AccountSelector />
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/reports')} className="p-3 md:p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-secondary hover:text-text-primary rounded-md hover:bg-surface-hover hidden sm:flex" title="Reports">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button onClick={() => navigate('/alerts')} className="relative p-3 md:p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-secondary hover:text-text-primary rounded-md hover:bg-surface-hover">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {activeCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-critical text-[10px] font-bold text-white rounded-full flex items-center justify-center">{activeCount > 9 ? '9+' : activeCount}</span>}
          </button>
          <button onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'zh' : 'en')} className="p-3 md:p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-xs text-text-secondary hover:text-text-primary rounded-md hover:bg-surface-hover font-medium" title={t('language.switchToChinese')}>
            {i18n.language === 'en' ? '中文' : 'EN'}
          </button>
          <div className="flex items-center gap-2 pl-2 border-l border-border-default">
            <button onClick={() => navigate('/settings')} className="p-3 md:p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-muted hover:text-text-primary rounded-md hover:bg-surface-hover">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <RoleBadge />
            <button onClick={handleLogoutClick} className="p-3 md:p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-muted hover:text-critical rounded-md hover:bg-surface-hover" title={t('user.logout')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>
      <Dialog open={logoutOpen} onClose={() => setLogoutOpen(false)}>
        <DialogTitle>Logout</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to log out?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogoutOpen(false)}>Cancel</Button>
          <Button onClick={confirmLogout} color="error" variant="contained" autoFocus>
            Logout
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
