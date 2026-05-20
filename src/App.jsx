import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import InviteAccept from './pages/InviteAccept';

function FirebaseConfigError() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'linear-gradient(135deg, #eef2f7 0%, #dfe9f5 100%)', fontFamily: "'Nunito', 'Segoe UI', sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 560, background: '#fff', border: '1px solid #dde6f0', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,0.12)', padding: 28 }}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>🌳</div>
        <h1 style={{ margin: '0 0 8px', color: '#1c2d3e', fontSize: 26, fontWeight: 800 }}>Firebase configuration missing</h1>
        <p style={{ margin: '0 0 18px', color: '#5a7a96', fontSize: 15, lineHeight: 1.55 }}>
          This deployment started, but Firebase failed to initialize. Set the Vercel project environment variables and redeploy.
        </p>
        <div style={{ background: '#eef2f7', borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <div style={{ color: '#1c2d3e', fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Required variables</div>
          <code style={{ display: 'block', color: '#3a78c9', fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
            VITE_FIREBASE_API_KEY{`\n`}
            VITE_FIREBASE_AUTH_DOMAIN{`\n`}
            VITE_FIREBASE_PROJECT_ID{`\n`}
            VITE_FIREBASE_STORAGE_BUCKET{`\n`}
            VITE_FIREBASE_MESSAGING_SENDER_ID{`\n`}
            VITE_FIREBASE_APP_ID
          </code>
        </div>
        <p style={{ margin: 0, color: '#8aafc0', fontSize: 13 }}>
          Add them in Vercel Project Settings → Environment Variables, then trigger a redeploy.
        </p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, firebaseInitError } = useAuth();
  if (firebaseInitError) return <FirebaseConfigError />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user, firebaseInitError } = useAuth();
  if (firebaseInitError) return <FirebaseConfigError />;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/invite/:inviteId" element={
        <ProtectedRoute>
          <InviteAccept />
        </ProtectedRoute>
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
