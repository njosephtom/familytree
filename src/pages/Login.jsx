import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [isSignUp, setIsSignUp]       = useState(false);
  const [isForgot, setIsForgot]       = useState(false);
  const [resetSent, setResetSent]     = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [rememberMe, setRememberMe]   = useState(false);

  // Preserve ?invite=xxx through the login flow
  const params     = new URLSearchParams(location.search);
  const inviteId   = params.get('invite');
  const afterLogin = inviteId ? `/invite/${inviteId}` : '/dashboard';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignUp) {
        if (!displayName.trim()) { setError('Please enter your name'); setLoading(false); return; }
        await signUpWithEmail(email, password, displayName.trim());
      } else {
        await signInWithEmail(email, password);
      }
      navigate(afterLogin, { replace: true });
    } catch (err) {
      console.error('Auth error:', err.code, err.message);
      setError(friendlyError(err.code, err.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (err) {
      setError(friendlyError(err.code, err.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      navigate(afterLogin, { replace: true });
    } catch (err) {
      console.error('Google auth error:', err.code, err.message);
      setError(friendlyError(err.code, err.message));
    } finally {
      setLoading(false);
    }
  }

  // ── Forgot-password screen ───────────────────────────────────────────────
  if (isForgot) {
    return (
      <PageShell>
        <AuthCard>
          <BrandMark />
          <h1 className="w-full text-[clamp(1.75rem,6vw,2.15rem)] font-bold text-[#0f172a]">Reset password</h1>

          {resetSent ? (
            <div className="flex w-full flex-col items-center gap-3 text-center">
              <p className="text-sm font-semibold text-[#0f172a]">Reset link sent</p>
              <p className="text-sm text-[#475569]">Check your inbox at <strong>{email}</strong>.</p>
              <BtnPrimary onClick={() => { setIsForgot(false); setResetSent(false); setError(''); }}>
                Back to Sign in
              </BtnPrimary>
            </div>
          ) : (
            <form onSubmit={handleForgot} className="flex w-full flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="reset-email" className="text-sm font-medium text-[#374151]">Email</label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  autoFocus
                  className="w-full rounded border border-[#cbd5e1] bg-[#ffffff] px-3 py-2 text-sm text-[#0f172a] placeholder:text-[#94a3b8] outline-none transition focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
                />
              </div>

              {error && (
                <div className="rounded border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]">{error}</div>
              )}

              <BtnPrimary type="submit" disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link'}
              </BtnPrimary>

              <button
                type="button"
                onClick={() => { setIsForgot(false); setError(''); }}
                className="self-center text-sm text-[#475569] underline hover:text-[#0f172a] border-0 bg-transparent cursor-pointer outline-none"
              >
                Back to Sign in
              </button>
            </form>
          )}
        </AuthCard>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <AuthCard>
        <BrandMark />

        <h1 className="w-full text-[clamp(1.75rem,6vw,2.15rem)] font-bold text-[#0f172a]">
          {isSignUp ? 'Sign up' : 'Sign in'}
        </h1>

        {inviteId && (
          <div className="w-full rounded border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-sm text-[#1d4ed8]">
            You have a family tree invite. Sign in or create an account to accept it.
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
          {isSignUp && (
            <div className="flex flex-col gap-1">
              <label htmlFor="displayName" className="text-sm font-medium text-[#374151]">Name</label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                required
                autoFocus
                className="w-full rounded border border-[#cbd5e1] bg-[#ffffff] px-3 py-2 text-sm text-[#0f172a] placeholder:text-[#94a3b8] outline-none transition focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium text-[#374151]">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoFocus={!isSignUp}
              className="w-full rounded border border-[#cbd5e1] bg-[#ffffff] px-3 py-2 text-sm text-[#0f172a] placeholder:text-[#94a3b8] outline-none transition focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-[#374151]">Password</label>
              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => { setIsForgot(true); setError(''); setResetSent(false); }}
                  className="text-xs text-[#475569] underline hover:text-[#0f172a] border-0 bg-transparent cursor-pointer outline-none"
                >
                  Forgot your password?
                </button>
              )}
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              required
              className="w-full rounded border border-[#cbd5e1] bg-[#ffffff] px-3 py-2 text-sm text-[#0f172a] placeholder:text-[#94a3b8] outline-none transition focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
            />
          </div>

          {!isSignUp && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[#374151] select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-[#cbd5e1] accent-[#0f172a]"
              />
              Remember me
            </label>
          )}

          {error && (
            <div className="rounded border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-[#0f172a] py-2 text-sm font-semibold text-white transition hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Please wait…' : isSignUp ? 'Sign up' : 'Sign in'}
          </button>
        </form>

        {/* ── Divider ── */}
        <div className="flex w-full items-center gap-3">
          <div className="h-px flex-1 bg-[#e2e8f0]" />
          <span className="text-sm text-[#64748b]">or</span>
          <div className="h-px flex-1 bg-[#e2e8f0]" />
        </div>

        {/* ── Social buttons ── */}
        <div className="flex w-full flex-col gap-4">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded border border-[#cbd5e1] bg-[#ffffff] py-2 text-sm font-semibold text-[#374151] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#4285F4" d="M47.5 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h13.2c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.3 7.3-10.6 7.3-17.3z"/>
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.9-6c-2.2 1.5-5 2.3-8 2.3-6.1 0-11.3-4.1-13.2-9.7H2.7v6.2C6.7 42.9 14.8 48 24 48z"/>
              <path fill="#FBBC05" d="M10.8 28.8c-.5-1.5-.8-3-.8-4.8s.3-3.3.8-4.8v-6.2H2.7C1 16.4 0 20.1 0 24s1 7.6 2.7 10.9l8.1-6.1z"/>
              <path fill="#EA4335" d="M24 9.5c3.4 0 6.5 1.2 8.9 3.5l6.7-6.7C35.9 2.5 30.5 0 24 0 14.8 0 6.7 5.1 2.7 12.9l8.1 6.2c1.9-5.6 7.1-9.6 13.2-9.6z"/>
            </svg>
            {isSignUp ? 'Sign up with Google' : 'Sign in with Google'}
          </button>

          <p className="text-center text-sm text-[#475569]">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="font-semibold text-[#0f172a] underline hover:text-[#475569] border-0 bg-transparent cursor-pointer outline-none"
            >
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </AuthCard>
    </PageShell>
  );
}

/* ── Shared layout primitives ────────────────────────────────────────────── */

function PageShell({ children }) {
  return (
    <div
      className="relative min-h-screen w-screen flex items-center justify-center p-4 sm:p-8"
      style={{ background: 'radial-gradient(ellipse at 50% 50%, hsl(210,100%,97%), hsl(0,0%,100%))' }}
    >
      {children}
    </div>
  );
}

function AuthCard({ children }) {
  return (
    <div className="flex w-full max-w-[450px] flex-col items-start gap-4 rounded-xl border border-[#e2e8f0] bg-[#ffffff] p-8 shadow-[hsla(220,30%,5%,0.05)_0px_5px_15px_0px,hsla(220,25%,10%,0.05)_0px_15px_35px_-5px]">
      {children}
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-1.5 text-[#3a78c9]">
      <span className="text-base leading-none" aria-hidden="true">🌳</span>
      <span className="text-sm font-bold tracking-tight">Family Tree</span>
    </div>
  );
}

function BtnPrimary({ children, ...props }) {
  return (
    <button
      type={props.type || 'button'}
      {...props}
      className="w-full rounded bg-[#0f172a] py-2 text-sm font-semibold text-white transition hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function friendlyError(code, message) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed. Please try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.';
    case 'auth/configuration-not-found':
    case 'auth/invalid-api-key':
      return 'Firebase is not configured yet. Fill in VITE_FIREBASE_API_KEY in .env.local';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled. Enable Email/Password in Firebase Console -> Authentication -> Sign-in method.';
    default:
      return `Error (${code || 'unknown'}): ${message || 'Please try again.'}`;
  }
}
