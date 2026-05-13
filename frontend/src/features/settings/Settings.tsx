import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/shared/stores/authStore';
import { useNavigate } from 'react-router-dom';
import { logout } from '@/features/auth/api';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [language, setLanguage] = useState(i18n.language);

  const handleLanguageChange = (lng: string) => {
    i18n.changeLanguage(lng);
    setLanguage(lng);
  };

  const handleLogout = () => {
    logout();
    clearAuth();
    navigate('/login');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold text-text-primary">{t('settings.title')}</h1>
        <p className="text-sm text-text-muted mt-0.5">{t('settings.subtitle')}</p>
      </div>

      <div className="rounded-lg border border-border-default bg-surface-card p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-4">{t('settings.profile')}</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-lg font-bold text-accent">
              {user?.username?.charAt(0).toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">{user?.username}</p>
              <p className="text-xs text-text-muted">{user?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <span className="text-xs text-text-muted block">{t('settings.role')}</span>
              <span className="text-sm text-text-primary capitalize">{user?.role || 'user'}</span>
            </div>
            <div>
              <span className="text-xs text-text-muted block">{t('settings.userId')}</span>
              <span className="text-sm text-text-primary font-mono">{user?.id}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border-default bg-surface-card p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-4">{t('settings.preferences')}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">{t('settings.language')}</label>
            <div className="flex gap-2">
              {['en', 'zh'].map((lng) => (
                <button
                  key={lng}
                  onClick={() => handleLanguageChange(lng)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                    language === lng ? 'bg-accent text-white' : 'bg-surface-base text-text-secondary hover:text-text-primary border border-border-default'
                  }`}
                >
                  {t(`settings.${lng === 'en' ? 'english' : 'chinese'}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-critical/30 bg-critical-bg p-5">
        <h2 className="text-sm font-semibold text-critical mb-2">{t('settings.dangerZone')}</h2>
        <p className="text-xs text-critical/80 mb-3">{t('settings.dangerZoneDesc')}</p>
        <button onClick={handleLogout} className="px-4 py-2 rounded-lg bg-critical/20 hover:bg-critical/30 text-critical text-sm font-medium transition-colors min-h-[44px]">
          {t('settings.logOut')}
        </button>
      </div>
    </div>
  );
}
