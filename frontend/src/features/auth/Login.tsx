import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { login, register } from '@/features/auth/api';
import { useAuthStore } from '@/shared/stores/authStore';
import { useAuth } from '@/features/auth/AuthContext';

export default function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setAuth } = useAuthStore();
  const { setAccount, setPermissions } = useAuth();
  const [tab, setTab] = useState<0 | 1>(0);
  // Redirect to accept-invitation if token is in URL
  const urlToken = searchParams.get('token');
  if (urlToken) {
    navigate(`/accept-invitation?token=${urlToken}`, { replace: true });
  }

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const invited = searchParams.get('accepted') === '1';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (tab === 0) {
      const result = await login(email, password);
      if (result.success && result.data) {
        setAuth(result.data.user, result.data.token);
        if (result.data.account) setAccount(result.data.account);
        if (result.data.permissions) setPermissions(result.data.permissions);
        navigate('/dashboard');
      } else setError(result.error || t('auth.loginFailed'));
    } else {
      const result = await register(username, email, password);
      if (result.success) { setTab(0); setError(t('auth.registerSuccess')); }
      else setError(result.error || t('auth.registerFailed'));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1117] via-[#1a2f1a] to-[#0f1117] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-40 left-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-40 right-10 w-96 h-96 bg-accent/3 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">{t('auth.appTitle')}</h1>
          <p className="text-sm text-text-muted mt-2">{t('auth.appSubtitle')}</p>
        </div>

        <div className="rounded-xl border border-border-default bg-surface-card p-6 shadow-lg backdrop-blur-sm bg-opacity-95 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {/* Tab Navigation */}
          <div className="flex gap-1 rounded-lg bg-surface-base p-1 mb-6">
            <button
              onClick={() => setTab(0)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                tab === 0
                  ? 'bg-accent text-white shadow-md'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t('auth.signIn')}
            </button>
            <button
              onClick={() => setTab(1)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                tab === 1
                  ? 'bg-accent text-white shadow-md'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t('auth.createAccount')}
            </button>
          </div>

          {/* Success Message */}
          {invited && (
            <div className="text-sm p-3 rounded-lg mb-4 bg-success-bg text-success flex items-center gap-2 animate-slide-up">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {t('auth.invitationAccepted')}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              className={`text-sm p-3 rounded-lg mb-4 flex items-center gap-2 animate-slide-up ${
                error.includes('successful')
                  ? 'bg-success-bg text-success'
                  : 'bg-critical-bg text-critical'
              }`}
            >
              {error.includes('successful') ? (
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 1 && (
              <div className="animate-slide-up">
                <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('auth.username')}</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/50 focus:shadow-lg transition-all duration-200"
                  placeholder={t('auth.yourUsername')}
                  required
                />
              </div>
            )}
            <div className="animate-slide-up" style={{ animationDelay: tab === 1 ? '0.1s' : '0s' }}>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('auth.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/50 focus:shadow-lg transition-all duration-200"
                placeholder={t('auth.yourEmail')}
                required
              />
            </div>
            <div className="animate-slide-up" style={{ animationDelay: tab === 1 ? '0.2s' : '0.1s' }}>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('auth.password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/50 focus:shadow-lg transition-all duration-200"
                placeholder={t('auth.yourPassword')}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5 active:scale-95 animate-slide-up"
              style={{ animationDelay: tab === 1 ? '0.3s' : '0.2s' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('common.loading')}
                </span>
              ) : tab === 0 ? (
                t('auth.signIn')
              ) : (
                t('auth.createAccount')
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
