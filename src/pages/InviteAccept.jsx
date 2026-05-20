import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getInvite, acceptInvite, declineInvite } from '../utils/firestoreService';

export default function InviteAccept() {
  const { inviteId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [invite, setInvite]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);

  useEffect(() => {
    getInvite(inviteId)
      .then(setInvite)
      .catch(() => setError('Invite not found or has expired.'))
      .finally(() => setLoading(false));
  }, [inviteId]);

  async function handleAccept() {
    setWorking(true);
    try {
      await acceptInvite(inviteId, user.uid);
      setDone(true);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch {
      setError('Failed to accept invite. Please try again.');
    } finally {
      setWorking(false);
    }
  }

  async function handleDecline() {
    setWorking(true);
    try {
      await declineInvite(inviteId);
      navigate('/dashboard');
    } catch {
      setError('Failed to decline invite.');
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading invite…</p>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="card max-w-md w-full text-center">
          <p className="text-red-600 mb-4">{error || 'Invite not found.'}</p>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (invite.status === 'accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="card max-w-md w-full text-center">
          <p className="text-green-600 font-semibold mb-2">✅ Invite already accepted</p>
          <p className="text-gray-600 mb-4">You're already a member of <strong>{invite.treeName}</strong>.</p>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="card max-w-md w-full text-center">
          <p className="text-green-600 text-xl font-semibold">🎉 Joined!</p>
          <p className="text-gray-500 mt-2">Redirecting to dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600 p-4">
      <div className="card max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🌳</div>
          <h1 className="text-2xl font-bold text-gray-800">Family Tree Invite</h1>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-center">
          <p className="text-gray-700">
            <strong>{invite.invitedByName}</strong> has invited you to join
          </p>
          <p className="text-xl font-bold text-blue-700 mt-1">{invite.treeName}</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            className="btn btn-primary flex-1"
            onClick={handleAccept}
            disabled={working}
          >
            {working ? 'Joining…' : '✅ Accept & Join'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleDecline}
            disabled={working}
          >
            Decline
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Signed in as {user.email}
        </p>
      </div>
    </div>
  );
}
