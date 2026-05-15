import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { register } from '@/features/auth/api';

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
      <div className="min-h-screen bg-surface-base flex items-center justify-center p-4">
        <div className="text-sm text-text-muted">Loading invitation...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Accept Invitation</h1>
        </div>

        <div className="rounded-xl border border-border-default bg-surface-card p-6">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg mb-4">
              {error}
              {!token && <span className="block mt-2">Please ask the account owner to send you a new invitation.</span>}
            </div>
          )}

          {invitation && (
            <>
              <div className="text-center mb-6 p-4 rounded-lg bg-accent/10">
                <p className="text-sm text-text-secondary">You've been invited to join</p>
                <p className="text-lg font-bold text-text-primary mt-1">{invitation.account_name}</p>
                <p className="text-xs text-text-muted mt-1">
                  Role: <span className="font-medium text-accent capitalize">{invitation.role}</span>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Email</label>
                  <input
                    type="email"
                    value={invitation.email}
                    readOnly
                    className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-muted text-sm cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-base border border-border-default text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent"
                    placeholder="Minimum 6 characters"
                    minLength={6}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Creating account...' : 'Accept & Create Account'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
