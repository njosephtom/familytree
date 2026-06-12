import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
const FamilyTreeApp = lazy(() => import('../components/FamilyTreeApp'));
import ErrorBoundary from '../components/ErrorBoundary';
import {
  getUserFamilyTrees,
  createFamilyTree,
  deleteFamilyTree,
  createInvite,
  getTreeInvites,
  subscribeToTreePresence,
  setUserPresence,
  clearUserPresence,
  getUserTreeLayout,
  getAllFamilyTrees,
  getAllUsers,
  removeMemberFromTree,
  updateMemberRole,
  getUser,
} from '../utils/firestoreService';

/* ── Design tokens (mirrors FamilyTreeApp) ── */
const T = {
  bg: '#eef2f7',
  white: '#ffffff',
  text: '#1c2d3e',
  textSub: '#5a7a96',
  textMuted: '#8aafc0',
  accent: '#3a78c9',
  red: '#d94f4f',
  toolbar: '#ffffff',
  toolbarBorder: '#d8e4ef',
  panelBorder: '#dde6f0',
};
const SF = "'Nunito', 'Segoe UI', sans-serif";

const AVATAR_COLORS = ['#3a78c9', '#d67aaa', '#7ad69a', '#d6a87a', '#9a7ad6', '#7aaed6'];
function avatarColor(uid) {
  let h = 0;
  for (const c of uid) h = ((h << 5) - h) + c.charCodeAt(0);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function userInitials(displayName, email) {
  const src = displayName || email || '?';
  return src.split(/[\s@]/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function Avatar({ user: u, size = 28, style: extra }) {
  const bg = avatarColor(u?.uid || '');
  return (
    <div
      title={u?.displayName || u?.email || ''}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: u?.photoURL ? 'transparent' : bg,
        border: `2px solid ${T.white}`,
        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontSize: size * 0.35, fontWeight: 800, color: '#fff', fontFamily: SF,
        ...extra,
      }}
    >
      {u?.photoURL
        ? <img src={u.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
        : userInitials(u?.displayName, u?.email)}
    </div>
  );
}

function Modal({ title, onClose, children, footer }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,40,70,0.45)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, fontFamily: SF }}>
      <div style={{ background: T.white, borderRadius: 16, width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', border: `1px solid ${T.panelBorder}`, display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
        <div style={{ padding: '20px 24px 14px', borderBottom: `1px solid ${T.panelBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `linear-gradient(135deg,${T.bg} 0%,${T.white} 60%)`, flexShrink: 0 }}>
          <h3 style={{ margin: 0, color: T.text, fontSize: 17, fontWeight: 800, fontFamily: SF }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textMuted, fontSize: 24, cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
        </div>
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div style={{ padding: '14px 24px', borderTop: `1px solid ${T.panelBorder}`, display: 'flex', justifyContent: 'flex-end', gap: 10, background: `${T.bg}88`, flexShrink: 0 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, logOut } = useAuth();
  const navigate = useNavigate();

  const [trees, setTrees]             = useState([]);
  const [activeTreeId, setActiveTreeId] = useState(null);
  const [loadingTrees, setLoadingTrees] = useState(true);
  const [activeLayout, setActiveLayout] = useState(undefined); // undefined = still loading
  const [treeToolbarEl, setTreeToolbarEl] = useState(null);

  /* Online presence for active tree */
  const [onlineUsers, setOnlineUsers] = useState([]);

  /* Create-tree dialog */
  const [showNewTree, setShowNewTree] = useState(false);
  const [newTreeName, setNewTreeName] = useState('');
  const [creating, setCreating]       = useState(false);

  /* Invite dialog */
  const [inviteTree, setInviteTree]   = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole]   = useState('viewer');
  const [inviteList, setInviteList]   = useState([]);
  const [inviting, setInviting]       = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteCopied, setInviteCopied] = useState('');
  const [inviteMailto, setInviteMailto] = useState('');
  const [resendCopied, setResendCopied] = useState(''); // inviteId that was just re-copied

  /* Settings modal */
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTrees, setSettingsTrees] = useState([]);
  const [settingsUsers, setSettingsUsers] = useState([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsConfirmUid, setSettingsConfirmUid] = useState('');
  const [settingsRemoving, setSettingsRemoving] = useState('');
  const [settingsExpandedTree, setSettingsExpandedTree] = useState(null);

  /* User menu */
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef();

  /* Load trees on mount */
  useEffect(() => {
    if (!user) return;
    setLoadingTrees(true);
    getUserFamilyTrees(user.uid)
      .then((list) => {
        setTrees(list);
        if (list.length > 0) setActiveTreeId(list[0].id);
      })
      .finally(() => setLoadingTrees(false));
  }, [user]);

  /* Load per-user layout for active tree */
  useEffect(() => {
    if (!user || !activeTreeId) { setActiveLayout(null); return; }
    setActiveLayout(undefined);
    getUserTreeLayout(user.uid, activeTreeId)
      .then((layout) => setActiveLayout(layout ?? null))
      .catch(() => setActiveLayout(null));
  }, [user, activeTreeId]);

  /* Presence for active tree */
  useEffect(() => {
    if (!user || !activeTreeId) { setOnlineUsers([]); return; }
    const data = {
      displayName: user.displayName || user.email || 'Unknown',
      email: user.email || '',
      photoURL: user.photoURL || '',
    };
    setUserPresence(activeTreeId, user.uid, data).catch(() => {});
    const hb = setInterval(() => setUserPresence(activeTreeId, user.uid, data).catch(() => {}), 30_000);
    const unsub = subscribeToTreePresence(activeTreeId, setOnlineUsers);
    return () => {
      clearInterval(hb);
      unsub?.();
      clearUserPresence(activeTreeId, user.uid).catch(() => {});
    };
  }, [user, activeTreeId]);

  /* Close user menu on outside click */
  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowUserMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  async function handleLogout() {
    await logOut();
    navigate('/login');
  }

  async function handleDeleteTree() {
    if (!activeTreeId || !user) return;
    try {
      await deleteFamilyTree(activeTreeId, user.uid);
      const updated = trees.filter((t) => t.id !== activeTreeId);
      setTrees(updated);
      setActiveTreeId(updated.length > 0 ? updated[0].id : null);
    } catch (err) {
      console.error('Failed to delete tree', err);
    }
  }

  async function handleCreateTree(e) {
    e.preventDefault();
    if (!newTreeName.trim()) return;
    setCreating(true);
    try {
      const id = await createFamilyTree(user.uid, newTreeName.trim());
      const fresh = await getUserFamilyTrees(user.uid);
      setTrees(fresh);
      setActiveTreeId(id);
      setShowNewTree(false);
      setNewTreeName('');
    } finally {
      setCreating(false);
    }
  }

  async function openInviteDialog(treeId) {
    setInviteTree(treeId);
    setInviteEmail('');
    setInviteRole('viewer');
    setInviteError('');
    setInviteCopied('');
    setInviteMailto('');
    setResendCopied('');
    const list = await getTreeInvites(treeId);
    setInviteList(list);
  }

  async function handleSendInvite(e) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError('');
    try {
      const tree = trees.find((t) => t.id === inviteTree);
      const emailTo = inviteEmail.trim();
      const inviteId = await createInvite(inviteTree, tree.name, user.uid, user.displayName || user.email, emailTo, inviteRole);
      const link = `${window.location.origin}/invite/${inviteId}`;
      await navigator.clipboard.writeText(link);
      setInviteCopied(link);

      // Build mailto so user can send it from their email client
      const subject = encodeURIComponent(`You've been invited to join the "${tree.name}" family tree`);
      const body = encodeURIComponent(
        `Hi,\n\n${user.displayName || user.email} has invited you to join the "${tree.name}" family tree.\n\nClick the link below to accept your invitation:\n${link}\n\nBest regards`
      );
      setInviteMailto(`mailto:${emailTo}?subject=${subject}&body=${body}`);

      setInviteEmail('');
      setInviteList(await getTreeInvites(inviteTree));
    } catch {
      setInviteError('Failed to create invite. Please try again.');
    } finally {
      setInviting(false);
    }
  }

  async function handleResendInvite(inv) {
    const link = `${window.location.origin}/invite/${inv.id}`;
    await navigator.clipboard.writeText(link);
    setResendCopied(inv.id);
    setTimeout(() => setResendCopied(''), 2500);
  }

  async function openSettings() {
    setShowSettings(true);
    setSettingsLoading(true);
    setSettingsExpandedTree(null);
    setSettingsConfirmUid('');
    try {
      const isAdmin = user?.email === 'admin@familytree.com';
      const treesToShow = isAdmin ? await getAllFamilyTrees() : trees;
      setSettingsTrees(treesToShow);

      // Fetch profiles for all unique member UIDs
      const allUids = new Set();
      treesToShow.forEach((t) => Object.keys(t.members || {}).forEach((uid) => allUids.add(uid)));
      const profiles = await Promise.all([...allUids].map((uid) => getUser(uid)));
      const userMap = {};
      [...allUids].forEach((uid, i) => { if (profiles[i]) userMap[uid] = profiles[i]; });
      setSettingsUsers(userMap);
    } finally {
      setSettingsLoading(false);
    }
  }

  async function handleSettingsRemoveMember(treeId, uid) {
    setSettingsRemoving(uid);
    try {
      await removeMemberFromTree(treeId, uid);
      setSettingsTrees((prev) => prev.map((t) => {
        if (t.id !== treeId) return t;
        const { [uid]: _, ...rest } = t.members || {};
        return { ...t, members: rest };
      }));
      setSettingsConfirmUid('');
    } finally {
      setSettingsRemoving('');
    }
  }

  async function handleSettingsRoleChange(treeId, uid, newRole) {
    await updateMemberRole(treeId, uid, newRole);
    setSettingsTrees((prev) => prev.map((t) => {
      if (t.id !== treeId) return t;
      return { ...t, members: { ...t.members, [uid]: { ...t.members[uid], role: newRole } } };
    }));
  }

  const activeTree = trees.find((t) => t.id === activeTreeId);

  /* Shared button styles */
  const BTN = (variant) => ({
    border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12,
    fontWeight: 700, cursor: 'pointer', fontFamily: SF, transition: 'opacity 0.15s',
    ...(variant === 'primary'   && { background: T.accent, color: '#fff', border: 'none' }),
    ...(variant === 'secondary' && { background: T.bg, border: `1px solid ${T.panelBorder}`, color: T.textSub }),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: T.bg, fontFamily: SF }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');`}</style>

      {/* ── Tab / nav bar ── */}
      <div style={{
        height: 48, background: T.toolbar, borderBottom: `1px solid ${T.toolbarBorder}`,
        display: 'flex', alignItems: 'center', padding: '0 12px',
        flexShrink: 0, zIndex: 200, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', gap: 0, overflow: 'visible',
      }}>
        {/* App logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 14, borderRight: `1px solid ${T.panelBorder}`, marginRight: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 20 }}>🌳</span>
          <span style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>Family Tree</span>
        </div>

        {/* Tree tabs */}
        <div style={{ display: 'flex', alignItems: 'stretch', height: '100%', flexShrink: 0, borderRight: `1px solid ${T.panelBorder}` }}>
          {loadingTrees ? (
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', color: T.textMuted, fontSize: 12 }}>Loading…</div>
          ) : (
            <>
              {trees.map((tree) => (
                <button
                  key={tree.id}
                  onClick={() => setActiveTreeId(tree.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', fontFamily: SF,
                    borderBottom: `2.5px solid ${activeTreeId === tree.id ? T.accent : 'transparent'}`,
                    color: activeTreeId === tree.id ? T.accent : T.textSub,
                    padding: '0 14px', height: '100%', fontSize: 13, fontWeight: 700,
                    whiteSpace: 'nowrap', transition: 'all 0.15s', flexShrink: 0,
                  }}
                >
                  {tree.name}
                </button>
              ))}
              <button
                onClick={() => setShowNewTree(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: SF, color: T.textMuted, padding: '0 14px', height: '100%', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}
                title="New family tree"
              >
                + New Tree
              </button>
            </>
          )}
        </div>

        {/* Portal slot — FamilyTreeApp injects its controls here */}
        <div
          ref={setTreeToolbarEl}
          style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 7, padding: '0 10px', overflow: 'visible', minWidth: 0, position: 'relative' }}
        />

        {/* Right: online users + user menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 12, borderLeft: `1px solid ${T.panelBorder}`, flexShrink: 0 }}>

          {/* Online user avatars */}
          {onlineUsers.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex' }}>
                {onlineUsers.slice(0, 5).map((u, i) => (
                  <Avatar key={u.uid} user={u} size={26}
                    style={{ marginLeft: i > 0 ? -7 : 0, zIndex: 10 - i, position: 'relative', boxShadow: `0 0 0 2px ${T.white}` }}
                  />
                ))}
                {onlineUsers.length > 5 && (
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: T.textMuted, border: `2px solid ${T.white}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -7, fontSize: 9, fontWeight: 800, color: '#fff' }}>
                    +{onlineUsers.length - 5}
                  </div>
                )}
              </div>
              <span style={{ color: T.textMuted, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {onlineUsers.length} online
              </span>
            </div>
          )}

          {/* User avatar + dropdown */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu((v) => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <Avatar user={{ uid: user?.uid || 'x', displayName: user?.displayName, email: user?.email, photoURL: user?.photoURL }} size={28} />
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5l3 3 3-3" stroke={T.textMuted} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            {showUserMenu && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: T.white, border: `1px solid ${T.panelBorder}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 180, zIndex: 500, overflow: 'hidden', fontFamily: SF }}>
                <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.panelBorder}` }}>
                  <div style={{ color: T.text, fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.displayName || 'User'}</div>
                  <div style={{ color: T.textMuted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
                </div>
                <button
                  onClick={() => { setShowUserMenu(false); openSettings(); }}
                  style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: T.text, cursor: 'pointer', fontSize: 13, fontWeight: 700, textAlign: 'left', fontFamily: SF }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = T.bg; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                >
                  ⚙ Settings
                </button>
                <button
                  onClick={handleLogout}
                  style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: T.red, cursor: 'pointer', fontSize: 13, fontWeight: 700, textAlign: 'left', fontFamily: SF }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = T.bg; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {loadingTrees ? null
          : trees.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
              <div style={{ fontSize: 56 }}>🌳</div>
              <p style={{ color: T.textSub, fontSize: 16, fontWeight: 700, margin: 0 }}>No family trees yet</p>
              <button style={BTN('primary')} onClick={() => setShowNewTree(true)}>Create Your First Family Tree</button>
            </div>
          ) : activeTree && activeLayout !== undefined ? (
            <ErrorBoundary key={activeTree.id}>
              <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><div style={{ color: T.textMuted, fontSize: 13 }}>Loading…</div></div>}>
                <FamilyTreeApp
                  key={activeTree.id}
                  treeId={activeTree.id}
                  treeName={activeTree.name}
                  initialPersons={activeTree.persons || []}
                  initialLayout={activeLayout}
                  uid={user?.uid}
                  username={user?.displayName || user?.email}
                  toolbarPortal={treeToolbarEl}
                  onInvite={() => openInviteDialog(activeTree.id)}
                  onDeleteTree={handleDeleteTree}
                />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ color: T.textMuted, fontSize: 13 }}>Loading…</div>
            </div>
          )
        }
      </div>

      {/* ── New Tree dialog ── */}
      {showNewTree && (
        <Modal
          title="🌳 New Family Tree"
          onClose={() => { setShowNewTree(false); setNewTreeName(''); }}
          footer={
            <>
              <button style={BTN('secondary')} onClick={() => { setShowNewTree(false); setNewTreeName(''); }}>Cancel</button>
              <button
                style={{ ...BTN('primary'), opacity: !newTreeName.trim() || creating ? 0.5 : 1 }}
                disabled={!newTreeName.trim() || creating}
                onClick={handleCreateTree}
              >
                {creating ? 'Creating…' : 'Create Tree'}
              </button>
            </>
          }
        >
          <form onSubmit={handleCreateTree}>
            <div>
              <label style={{ display: 'block', color: T.textMuted, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, fontFamily: SF }}>Tree Name</label>
              <input
                style={{ width: '100%', background: T.bg, border: `1px solid ${T.panelBorder}`, color: T.text, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: SF }}
                value={newTreeName}
                onChange={(e) => setNewTreeName(e.target.value)}
                placeholder="e.g. Smith Family"
                autoFocus
                required
              />
            </div>
          </form>
        </Modal>
      )}

      {/* ── Invite dialog ── */}
      {inviteTree && (() => {
        const ROLE_OPTIONS = [
          { value: 'admin',  label: '🛡 Admin',  desc: 'Can invite & manage members' },
          { value: 'editor', label: '✏ Editor', desc: 'Can edit tree data' },
          { value: 'viewer', label: '👁 Viewer', desc: 'Read-only access' },
        ];
        return (
          <Modal
            title={`👥 Invite to "${trees.find((t) => t.id === inviteTree)?.name}"`}
            onClose={() => setInviteTree(null)}
            footer={<button style={BTN('secondary')} onClick={() => setInviteTree(null)}>Close</button>}
          >
            <form onSubmit={handleSendInvite} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', color: T.textMuted, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, fontFamily: SF }}>Email Address</label>
                <input
                  type="email"
                  style={{ width: '100%', background: T.bg, border: `1px solid ${T.panelBorder}`, color: T.text, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: SF }}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="family.member@example.com"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', color: T.textMuted, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontFamily: SF }}>Role</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {ROLE_OPTIONS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setInviteRole(r.value)}
                      title={r.desc}
                      style={{
                        flex: 1, padding: '8px 6px', borderRadius: 8, cursor: 'pointer', fontFamily: SF,
                        fontSize: 11, fontWeight: 700, transition: 'all 0.15s',
                        border: inviteRole === r.value ? `2px solid ${T.accent}` : `2px solid ${T.panelBorder}`,
                        background: inviteRole === r.value ? '#eff6ff' : T.bg,
                        color: inviteRole === r.value ? T.accent : T.textSub,
                      }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <div style={{ color: T.textMuted, fontSize: 10, marginTop: 4 }}>
                  {ROLE_OPTIONS.find((r) => r.value === inviteRole)?.desc}
                </div>
              </div>
              {inviteError && <div style={{ color: T.red, fontSize: 12 }}>{inviteError}</div>}
              {inviteCopied && (
                <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#065f46' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>✓ Invite link copied to clipboard!</div>
                  <code style={{ fontSize: 10, wordBreak: 'break-all', display: 'block', marginBottom: 8 }}>{inviteCopied}</code>
                  <a
                    href={inviteMailto}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: T.accent, color: '#fff', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}
                  >
                    ✉ Open Email Client to Send
                  </a>
                </div>
              )}
              <button type="submit" style={{ ...BTN('primary'), opacity: inviting || !inviteEmail.trim() ? 0.5 : 1 }} disabled={inviting || !inviteEmail.trim()}>
                {inviting ? 'Creating invite…' : '✉ Send Invite'}
              </button>
            </form>
            {inviteList.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Sent Invites</div>
                {inviteList.map((inv) => (
                  <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: T.bg, borderRadius: 8, marginBottom: 6, gap: 8 }}>
                    <span style={{ color: T.text, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{inv.invitedEmail}</span>
                    {inv.role && inv.role !== 'member' && (
                      <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 5, padding: '2px 7px', flexShrink: 0, background: '#ede9fe', color: '#7c3aed' }}>
                        {inv.role}
                      </span>
                    )}
                    <span style={{
                      fontSize: 10, fontWeight: 700, borderRadius: 5, padding: '2px 8px', flexShrink: 0,
                      background: inv.status === 'accepted' ? '#d1fae5' : inv.status === 'declined' ? '#fee2e2' : '#fef3c7',
                      color: inv.status === 'accepted' ? '#065f46' : inv.status === 'declined' ? '#991b1b' : '#92400e',
                    }}>
                      {inv.status === 'accepted' ? '✓ Joined' : inv.status === 'declined' ? '✗ Declined' : 'Pending'}
                    </span>
                    {inv.status === 'pending' && (
                      <button
                        onClick={() => handleResendInvite(inv)}
                        title="Copy invite link to resend"
                        style={{ ...BTN('secondary'), padding: '3px 9px', fontSize: 10, flexShrink: 0, background: resendCopied === inv.id ? '#d1fae5' : undefined, color: resendCopied === inv.id ? '#065f46' : undefined }}
                      >
                        {resendCopied === inv.id ? '✓ Copied' : 'Resend Link'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Modal>
        );
      })()}

      {/* ── Settings modal ── */}
      {showSettings && (() => {
        const ROLE_META = {
          owner:  { label: '★ Owner',  bg: '#dbeafe', color: '#1d4ed8' },
          admin:  { label: '🛡 Admin',  bg: '#ede9fe', color: '#7c3aed' },
          editor: { label: '✏ Editor', bg: '#d1fae5', color: '#065f46' },
          viewer: { label: '👁 Viewer', bg: T.bg,      color: T.textSub },
        };
        return (
          <Modal
            title="⚙ Settings"
            onClose={() => setShowSettings(false)}
            footer={<button style={BTN('secondary')} onClick={() => setShowSettings(false)}>Close</button>}
          >
            {/* Profile */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Profile</div>
              <div style={{ background: T.bg, borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {(user?.displayName || user?.email || '?')[0].toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: T.text, fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.displayName || 'User'}</div>
                  <div style={{ color: T.textMuted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
                </div>
              </div>
            </div>

            {/* Family Trees & Members — visible to every user */}
            <div>
              <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Family Trees & Members</div>
              {settingsLoading ? (
                <div style={{ color: T.textMuted, fontSize: 13, padding: '16px 0' }}>Loading…</div>
              ) : settingsTrees.length === 0 ? (
                <div style={{ color: T.textMuted, fontSize: 13, padding: '16px 0' }}>No trees found.</div>
              ) : settingsTrees.map((tree) => {
                const memberEntries = Object.entries(tree.members || {});
                const isExpanded = settingsExpandedTree === tree.id;
                const isOwner = tree.members?.[user?.uid]?.role === 'owner';
                return (
                  <div key={tree.id} style={{ border: `1px solid ${T.panelBorder}`, borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
                    <button
                      onClick={() => setSettingsExpandedTree(isExpanded ? null : tree.id)}
                      style={{ width: '100%', background: T.bg, border: 'none', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontFamily: SF }}
                    >
                      <span style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>🌳 {tree.name || '(unnamed)'}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isOwner && <span style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', borderRadius: 5, padding: '2px 7px' }}>Owner</span>}
                        <span style={{ background: T.accent, color: '#fff', borderRadius: 12, padding: '1px 9px', fontSize: 11, fontWeight: 700 }}>
                          {memberEntries.length} member{memberEntries.length !== 1 ? 's' : ''}
                        </span>
                        <span style={{ color: T.textMuted, fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</span>
                      </span>
                    </button>

                    {isExpanded && (
                      <div style={{ padding: '8px 14px 12px' }}>
                        {memberEntries.length === 0 ? (
                          <div style={{ color: T.textMuted, fontSize: 12, padding: '8px 0' }}>No members.</div>
                        ) : memberEntries.map(([uid, info]) => {
                          const u = settingsUsers[uid] || {};
                          const memberIsOwner = info.role === 'owner';
                          const isConfirming = settingsConfirmUid === `${tree.id}:${uid}`;
                          const joined = info.joinedAt?.toDate?.()
                            ? info.joinedAt.toDate().toLocaleDateString() : '—';
                          const roleMeta = ROLE_META[info.role] || ROLE_META.viewer;
                          return (
                            <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${T.panelBorder}` }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                                {(u.displayName || u.email || uid)[0].toUpperCase()}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ color: T.text, fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {u.displayName || u.email || uid}
                                </div>
                                <div style={{ color: T.textMuted, fontSize: 10 }}>
                                  {u.email || ''}{u.email && joined !== '—' ? ' · ' : ''}{joined !== '—' ? `Joined ${joined}` : ''}
                                </div>
                              </div>

                              {/* Role: dropdown for owner managing others, badge otherwise */}
                              {isOwner && !memberIsOwner ? (
                                <select
                                  value={info.role || 'viewer'}
                                  onChange={(e) => handleSettingsRoleChange(tree.id, uid, e.target.value)}
                                  style={{ background: roleMeta.bg, color: roleMeta.color, border: 'none', borderRadius: 6, padding: '3px 6px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: SF, flexShrink: 0 }}
                                >
                                  <option value="admin">🛡 Admin</option>
                                  <option value="editor">✏ Editor</option>
                                  <option value="viewer">👁 Viewer</option>
                                </select>
                              ) : (
                                <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 5, padding: '2px 7px', flexShrink: 0, background: roleMeta.bg, color: roleMeta.color }}>
                                  {roleMeta.label}
                                </span>
                              )}

                              {/* Remove (owner can remove non-owners) */}
                              {isOwner && !memberIsOwner && (
                                isConfirming ? (
                                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                                    <button
                                      onClick={() => handleSettingsRemoveMember(tree.id, uid)}
                                      disabled={settingsRemoving === uid}
                                      style={{ background: T.red, border: 'none', color: '#fff', borderRadius: 6, padding: '3px 9px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                                    >
                                      {settingsRemoving === uid ? '…' : 'Confirm'}
                                    </button>
                                    <button
                                      onClick={() => setSettingsConfirmUid('')}
                                      style={{ background: T.bg, border: `1px solid ${T.panelBorder}`, color: T.textSub, borderRadius: 6, padding: '3px 9px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setSettingsConfirmUid(`${tree.id}:${uid}`)}
                                    style={{ background: '#fee2e2', border: 'none', color: T.red, borderRadius: 6, padding: '3px 9px', fontSize: 10, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                                  >
                                    Remove
                                  </button>
                                )
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
