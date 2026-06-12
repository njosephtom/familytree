import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAllFamilyTrees, getAllUsers, removeMemberFromTree } from '../utils/firestoreService';

const ADMIN_EMAIL = 'admin@familytree.com';

const T = {
  bg: '#eef2f7',
  white: '#ffffff',
  text: '#1c2d3e',
  textSub: '#5a7a96',
  textMuted: '#8aafc0',
  accent: '#3a78c9',
  accentHover: '#2a60aa',
  red: '#d94f4f',
  redLight: '#fee2e2',
  panelBorder: '#dde6f0',
  toolbar: '#ffffff',
  toolbarBorder: '#d8e4ef',
};
const SF = "'Nunito', 'Segoe UI', sans-serif";

function exportTreeXml(tree) {
  const persons = tree.persons || [];
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rows = persons.map((p) =>
    `  <person>\n${Object.entries(p).map(([k, v]) => {
      if (Array.isArray(v)) return `    <${k}>${v.map((id) => `<id>${esc(id)}</id>`).join('')}</${k}>`;
      if (v === null || v === undefined) return `    <${k}/>`;
      return `    <${k}>${esc(v)}</${k}>`;
    }).join('\n')}\n  </person>`
  ).join('\n');
  const content = `<?xml version="1.0" encoding="UTF-8"?>\n<familyTree>\n${rows}\n</familyTree>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/xml' }));
  a.download = `${(tree.name || tree.id).replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

function MembersModal({ tree, userMap, onClose, onRemoved }) {
  const [removing, setRemoving] = useState('');
  const [confirmUid, setConfirmUid] = useState('');

  const members = Object.entries(tree.members || {}).map(([uid, info]) => ({
    uid,
    role: info.role || 'member',
    joinedAt: info.joinedAt,
    ...userMap[uid],
  }));

  async function handleRemove(uid) {
    setRemoving(uid);
    try {
      await removeMemberFromTree(tree.id, uid);
      onRemoved(tree.id, uid);
      setConfirmUid('');
    } finally {
      setRemoving('');
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,40,70,0.45)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, fontFamily: SF }}>
      <div style={{ background: T.white, borderRadius: 16, width: '100%', maxWidth: 560, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', border: `1px solid ${T.panelBorder}`, display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>

        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: `1px solid ${T.panelBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `linear-gradient(135deg,${T.bg} 0%,${T.white} 60%)`, flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, color: T.text, fontSize: 16, fontWeight: 800 }}>👥 Members of "{tree.name}"</h3>
            <div style={{ color: T.textMuted, fontSize: 11, marginTop: 3 }}>{members.length} account{members.length !== 1 ? 's' : ''} with access</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textMuted, fontSize: 24, cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '14px 22px' }}>
          {members.length === 0 ? (
            <div style={{ color: T.textMuted, fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No members found.</div>
          ) : members.map((m) => {
            const joined = m.joinedAt?.toDate?.()
              ? m.joinedAt.toDate().toLocaleDateString()
              : '—';
            const isOwner = m.role === 'owner';
            const isConfirming = confirmUid === m.uid;

            return (
              <div key={m.uid} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${T.panelBorder}` }}>
                {/* Avatar */}
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 800, color: '#fff' }}>
                  {(m.displayName || m.email || '?')[0].toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: T.text, fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.displayName || m.email || m.uid}
                  </div>
                  <div style={{ color: T.textMuted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.email && m.displayName ? m.email : ''}{m.email && m.displayName ? ' · ' : ''}{joined !== '—' ? `Joined ${joined}` : ''}
                  </div>
                </div>

                {/* Role badge */}
                <span style={{
                  fontSize: 10, fontWeight: 700, borderRadius: 5, padding: '2px 8px', flexShrink: 0,
                  background: isOwner ? '#dbeafe' : T.bg,
                  color: isOwner ? '#1d4ed8' : T.textSub,
                }}>
                  {isOwner ? '★ Owner' : 'Member'}
                </span>

                {/* Remove / Confirm */}
                {!isOwner && (
                  isConfirming ? (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => handleRemove(m.uid)}
                        disabled={removing === m.uid}
                        style={{ background: T.red, border: 'none', color: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                      >
                        {removing === m.uid ? 'Removing…' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setConfirmUid('')}
                        style={{ background: T.bg, border: `1px solid ${T.panelBorder}`, color: T.textSub, borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmUid(m.uid)}
                      style={{ background: T.redLight, border: 'none', color: T.red, borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                    >
                      Remove
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 22px', borderTop: `1px solid ${T.panelBorder}`, display: 'flex', justifyContent: 'flex-end', background: `${T.bg}88`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: T.bg, border: `1px solid ${T.panelBorder}`, color: T.textSub, borderRadius: 8, padding: '7px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: SF }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const { user, logOut } = useAuth();
  const navigate = useNavigate();

  const [trees, setTrees]     = useState([]);
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [membersTree, setMembersTree] = useState(null); // tree whose members modal is open

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (user.email !== ADMIN_EMAIL) { navigate('/dashboard'); return; }
  }, [user, navigate]);

  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) return;
    setLoading(true);
    Promise.all([getAllFamilyTrees(), getAllUsers()])
      .then(([allTrees, allUsers]) => {
        setTrees(allTrees);
        setUsers(allUsers);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  async function handleLogout() {
    await logOut();
    navigate('/login');
  }

  function handleMemberRemoved(treeId, uid) {
    setTrees((prev) => prev.map((t) => {
      if (t.id !== treeId) return t;
      const { [uid]: _removed, ...rest } = t.members || {};
      return { ...t, members: rest };
    }));
    // Keep modal open with updated data
    setMembersTree((prev) => {
      if (!prev || prev.id !== treeId) return prev;
      const { [uid]: _removed, ...rest } = prev.members || {};
      return { ...prev, members: rest };
    });
  }

  const userMap = Object.fromEntries(users.map((u) => [u.uid || u.id, u]));

  const filtered = trees.filter((t) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const ownerEmail = userMap[t.createdBy]?.email || '';
    return (
      (t.name || '').toLowerCase().includes(q) ||
      ownerEmail.toLowerCase().includes(q)
    );
  });

  const totalJoinedUsers = trees.reduce((s, t) => s + Object.keys(t.members || {}).length, 0);

  if (!user || user.email !== ADMIN_EMAIL) return null;

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: SF }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap'); * { box-sizing: border-box; }`}</style>

      {/* ── Top bar ── */}
      <div style={{ height: 48, background: T.toolbar, borderBottom: `1px solid ${T.toolbarBorder}`, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <span style={{ fontSize: 20 }}>🌳</span>
        <span style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>Family Tree</span>
        <span style={{ color: T.panelBorder }}>|</span>
        <span style={{ color: T.accent, fontSize: 13, fontWeight: 800 }}>🛡 Account Settings</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: T.textMuted, fontSize: 12 }}>{user.email}</span>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ background: T.bg, border: `1px solid ${T.panelBorder}`, color: T.textSub, borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
          >
            ← Dashboard
          </button>
          <button
            onClick={handleLogout}
            style={{ background: 'none', border: `1px solid ${T.panelBorder}`, color: T.red, borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px' }}>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Total Trees', value: trees.length, icon: '🌳' },
            { label: 'Registered Users', value: users.length, icon: '👤' },
            { label: 'Total Joined Members', value: totalJoinedUsers, icon: '👥' },
          ].map(({ label, value, icon }) => (
            <div key={label} style={{ background: T.white, borderRadius: 14, padding: '18px 22px', border: `1px solid ${T.panelBorder}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>{icon}</div>
              <div style={{ color: T.text, fontSize: 26, fontWeight: 800 }}>{value}</div>
              <div style={{ color: T.textMuted, fontSize: 12, fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Search + table */}
        <div style={{ background: T.white, borderRadius: 16, border: `1px solid ${T.panelBorder}`, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.panelBorder}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0, color: T.text, fontSize: 16, fontWeight: 800 }}>All Family Trees</h2>
            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: T.textMuted, pointerEvents: 'none' }}>🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or owner…"
                style={{ background: T.bg, border: `1px solid ${T.panelBorder}`, color: T.text, borderRadius: 8, padding: '7px 12px 7px 28px', fontSize: 12, outline: 'none', width: 240, fontFamily: SF }}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>Loading all trees…</div>
          ) : error ? (
            <div style={{ padding: 40, textAlign: 'center', color: T.red, fontSize: 13 }}>Error: {error}</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: T.textMuted, fontSize: 13 }}>No trees found.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.bg }}>
                  {['Tree Name', 'Owner', 'Joined Members', 'Family Persons', 'Created', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '10px 18px', color: T.textMuted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: ['Joined Members', 'Family Persons', 'Actions'].includes(h) ? 'center' : 'left', borderBottom: `1px solid ${T.panelBorder}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((tree, i) => {
                  const owner = userMap[tree.createdBy];
                  const created = tree.createdAt?.toDate?.()
                    ? tree.createdAt.toDate().toLocaleDateString()
                    : '—';
                  const joinedCount = Object.keys(tree.members || {}).length;

                  return (
                    <tr
                      key={tree.id}
                      style={{ borderBottom: `1px solid ${T.panelBorder}`, background: i % 2 === 0 ? T.white : `${T.bg}55` }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#e8f0fb'}
                      onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? T.white : `${T.bg}55`}
                    >
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{tree.name || '(unnamed)'}</div>
                        <div style={{ color: T.textMuted, fontSize: 10, marginTop: 2 }}>{tree.id}</div>
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ color: T.textSub, fontSize: 12, fontWeight: 600 }}>{owner?.email || tree.createdBy || '—'}</div>
                        {owner?.displayName && <div style={{ color: T.textMuted, fontSize: 11 }}>{owner.displayName}</div>}
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                        <button
                          onClick={() => setMembersTree(tree)}
                          title="View and manage members"
                          style={{ background: T.bg, border: `1px solid ${T.panelBorder}`, color: T.accent, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: SF }}
                        >
                          👥 {joinedCount}
                        </button>
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                        <span style={{ background: T.bg, border: `1px solid ${T.panelBorder}`, color: T.textSub, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                          {tree.persons?.length ?? 0}
                        </span>
                      </td>
                      <td style={{ padding: '12px 18px', color: T.textMuted, fontSize: 12 }}>{created}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            onClick={() => setMembersTree(tree)}
                            style={{ background: T.accent, border: 'none', color: '#fff', borderRadius: 7, padding: '6px 12px', fontSize: 11, cursor: 'pointer', fontWeight: 800, whiteSpace: 'nowrap' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = T.accentHover; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = T.accent; }}
                          >
                            Manage Members
                          </button>
                          <button
                            onClick={() => exportTreeXml(tree)}
                            style={{ background: T.bg, border: `1px solid ${T.panelBorder}`, color: T.textSub, borderRadius: 7, padding: '6px 12px', fontSize: 11, cursor: 'pointer', fontWeight: 800, whiteSpace: 'nowrap' }}
                          >
                            ⬆ XML
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Members modal ── */}
      {membersTree && (
        <MembersModal
          tree={membersTree}
          userMap={userMap}
          onClose={() => setMembersTree(null)}
          onRemoved={handleMemberRemoved}
        />
      )}
    </div>
  );
}
