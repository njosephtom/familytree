import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { login } from '../store/slices/authSlice';
import { storageService } from '../utils/storageService';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (isSignUp) {
      // Mock sign up
      const user = { id: Math.random().toString(), username, email: `${username}@familytree.local` };
      dispatch(login(user));
      storageService.saveUser(user);
      navigate('/dashboard');
    } else {
      // Mock login
      if (username.length > 2 && password.length > 2) {
        const user = { id: Math.random().toString(), username, email: `${username}@familytree.local` };
        dispatch(login(user));
        storageService.saveUser(user);
        navigate('/dashboard');
      } else {
        setError('Invalid credentials');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Family Tree</h1>
            <p className="text-gray-600">Connect Your Generations</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary w-full">
              {isSignUp ? 'Create Account' : 'Sign In'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                {isSignUp
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"}
              </button>
            </div>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded border border-blue-200">
            <p className="text-sm text-gray-600 mb-2">
              <strong>Demo Mode:</strong> Use any username and password (minimum 3 characters) to proceed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
