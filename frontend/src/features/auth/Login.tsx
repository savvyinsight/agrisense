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
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">{t('auth.appTitle')}</h1>
          <p className="text-sm text-text-muted mt-1">{t('auth.appSubtitle')}</p>
        </div>

        <div className="rounded-xl border border-border-default bg-surface-card p-6">
          <div className="flex gap-1 rounded-lg bg-surface-base p-1 mb-6">
            <button onClick={() => setTab(0)} className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${tab === 0 ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}>{t('auth.signIn')}</button>
            <button onClick={() => setTab(1)} className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${tab === 1 ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}>{t('auth.createAccount')}</button>
          </div>

          {invited && <div className="text-sm p-3 rounded-lg mb-4 bg-success-bg text-success">Invitation accepted! Please log in with your new account.</div>}
          {error && <div className={`text-sm p-3 rounded-lg mb-4 ${error.includes('successful') ? 'bg-success-bg text-success' : 'bg-critical-bg text-critical'}`}>{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 1 && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('auth.username')}</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors" placeholder={t('auth.yourUsername')} required />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('auth.email')}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors" placeholder={t('auth.yourEmail')} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">{t('auth.password')}</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors" placeholder={t('auth.yourPassword')} required />
            </div>
            <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? t('common.loading') : tab === 0 ? t('auth.signIn') : t('auth.createAccount')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
