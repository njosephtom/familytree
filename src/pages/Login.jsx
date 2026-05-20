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
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="card">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">🌳 Family Tree</h1>
              <p className="text-gray-600">Reset your password</p>
            </div>

            {resetSent ? (
              <div className="text-center space-y-4">
                <div className="text-4xl">📧</div>
                <p className="text-gray-700 font-medium">Reset link sent!</p>
                <p className="text-sm text-gray-500">
                  Check your inbox at <strong>{email}</strong> and follow the link to set a new password.
                </p>
                <button
                  type="button"
                  onClick={() => { setIsForgot(false); setResetSent(false); setError(''); }}
                  className="btn btn-primary w-full"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="form-group">
                  <label htmlFor="reset-email">Email address</label>
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm">
                    {error}
                  </div>
                )}

                <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { setIsForgot(false); setError(''); }}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    ← Back to Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="card">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">🌳 Family Tree</h1>
            <p className="text-gray-600">Connect Your Generations</p>
          </div>

          {inviteId && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
              You have a family tree invite! Sign in or create an account to accept it.
            </div>
          )}

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg px-4 py-2.5 mb-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M47.5 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h13.2c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.3 7.3-10.6 7.3-17.3z"/>
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.9-6c-2.2 1.5-5 2.3-8 2.3-6.1 0-11.3-4.1-13.2-9.7H2.7v6.2C6.7 42.9 14.8 48 24 48z"/>
              <path fill="#FBBC05" d="M10.8 28.8c-.5-1.5-.8-3-.8-4.8s.3-3.3.8-4.8v-6.2H2.7C1 16.4 0 20.1 0 24s1 7.6 2.7 10.9l8.1-6.1z"/>
              <path fill="#EA4335" d="M24 9.5c3.4 0 6.5 1.2 8.9 3.5l6.7-6.7C35.9 2.5 30.5 0 24 0 14.8 0 6.7 5.1 2.7 12.9l8.1 6.2c1.9-5.6 7.1-9.6 13.2-9.6z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="form-group">
                <label htmlFor="displayName">Full Name</label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your full name"
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="form-group">
              <div className="flex items-center justify-between">
                <label htmlFor="password">Password</label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => { setIsForgot(true); setError(''); setResetSent(false); }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignUp ? 'At least 6 characters' : 'Your password'}
                required
              />
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Please wait…' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
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
      return 'This sign-in method is not enabled. Enable Email/Password in Firebase Console → Authentication → Sign-in method.';
    default:
      return `Error (${code || 'unknown'}): ${message || 'Please try again.'}`;
  }
}
