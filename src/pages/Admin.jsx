import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAllFamilyTrees, getAllUsers } from '../utils/firestoreService';

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

export default function Admin() {
  const { user, logOut } = useAuth();
  const navigate = useNavigate();

  const [trees, setTrees]     = useState([]);
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');

  // Guard: only admin@familytree.com
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

  if (!user || user.email !== ADMIN_EMAIL) return null;

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: SF }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap'); * { box-sizing: border-box; }`}</style>

      {/* ── Top bar ── */}
      <div style={{ height: 48, background: T.toolbar, borderBottom: `1px solid ${T.toolbarBorder}`, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <span style={{ fontSize: 20 }}>🌳</span>
        <span style={{ color: T.text, fontSize: 13, fontWeight: 800 }}>Family Tree</span>
        <span style={{ color: T.panelBorder }}>|</span>
        <span style={{ color: T.accent, fontSize: 13, fontWeight: 800 }}>🛡 Admin Panel</span>
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
            { label: 'Total Users', value: users.length, icon: '👥' },
            { label: 'Total Members', value: trees.reduce((s, t) => s + (t.persons?.length || 0), 0), icon: '👤' },
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
                  {['Tree Name', 'Owner', 'Members', 'Created', 'Export XML'].map((h) => (
                    <th key={h} style={{ padding: '10px 18px', color: T.textMuted, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: h === 'Members' || h === 'Export XML' ? 'center' : 'left', borderBottom: `1px solid ${T.panelBorder}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((tree, i) => {
                  const owner = userMap[tree.createdBy];
                  const created = tree.createdAt?.toDate?.()
                    ? tree.createdAt.toDate().toLocaleDateString()
                    : '—';
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
                        <span style={{ background: T.bg, border: `1px solid ${T.panelBorder}`, color: T.accent, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                          {tree.persons?.length ?? 0}
                        </span>
                      </td>
                      <td style={{ padding: '12px 18px', color: T.textMuted, fontSize: 12 }}>{created}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                        <button
                          onClick={() => exportTreeXml(tree)}
                          title={`Export "${tree.name}" as XML`}
                          style={{ background: T.accent, border: 'none', color: '#fff', borderRadius: 7, padding: '6px 14px', fontSize: 11, cursor: 'pointer', fontWeight: 800, whiteSpace: 'nowrap' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = T.accentHover; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = T.accent; }}
                        >
                          ⬆ XML
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
