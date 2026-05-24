import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { register } from '@/features/auth/api';
import AuthLayout from '@/shared/components/AuthLayout';

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invitation, setInvitation] = useState<{
    email: string;
    role: string;
    account_name: string;
    expires_at: string;
  } | null>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided');
      setLoading(false);
      return;
    }
    fetchInvitation();
  }, [token]);

  const fetchInvitation = async () => {
    try {
      const res = await fetch(`/api/v1/invitations/${token}`);
      if (res.ok) {
        const data = await res.json();
        setInvitation(data);
        setUsername(data.email.split('@')[0]);
        setError('');
      } else {
        const data = await res.json();
        setError(data.error || 'Invalid or expired invitation');
      }
    } catch {
      setError('Failed to load invitation');
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;
    setSubmitting(true);
    setError('');

    const result = await register(username, invitation.email, password, token);
    if (result.success) {
      navigate('/login?accepted=1');
    } else {
      setError(result.error || 'Registration failed');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <AuthLayout title="Accept Invitation" subtitle="Complete your account setup">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <svg className="w-8 h-8 animate-spin text-accent mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm text-text-muted">Loading invitation...</p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Accept Invitation" subtitle="Complete your account setup">
      <div className="text-center mb-8 md:hidden">
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Accept Invitation</h1>
      </div>

      <div className="rounded-xl border border-border-default bg-surface-card p-6 shadow-lg backdrop-blur-sm bg-opacity-95 animate-slide-up">
        {/* Error Message */}
        {error && (
          <div className="text-sm p-3 rounded-lg mb-4 bg-critical-bg text-critical flex items-center gap-2 animate-slide-up">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
            {!token && <span className="block mt-2 text-xs">Please ask the account owner to send you a new invitation.</span>}
          </div>
        )}

        {invitation && (
          <>
            {/* Invitation Info Card */}
            <div className="text-center mb-6 p-4 rounded-lg bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 animate-slide-up">
              <p className="text-sm text-text-secondary">You've been invited to join</p>
              <p className="text-lg font-bold text-text-primary mt-2">{invitation.account_name}</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="text-xs text-text-muted">Role:</span>
                <span className="inline-block px-2 py-1 rounded-md bg-accent/20 text-accent text-xs font-medium capitalize">
                  {invitation.role}
                </span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="animate-slide-up" style={{ animationDelay: '0s' }}>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/50 focus:shadow-lg transition-all duration-200"
                  required
                />
              </div>

              <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Email</label>
                <input
                  type="email"
                  value={invitation.email}
                  readOnly
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border-default text-text-muted text-sm cursor-not-allowed"
                />
              </div>

              <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/50 focus:shadow-lg transition-all duration-200"
                  placeholder="Minimum 6 characters"
                  minLength={6}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5 active:scale-95 animate-slide-up"
                style={{ animationDelay: '0.3s' }}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating account...
                  </span>
                ) : (
                  'Accept & Create Account'
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
