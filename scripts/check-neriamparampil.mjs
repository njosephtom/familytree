/**
 * Queries Firestore for the Neriamparampil family tree and validates its data.
 * Run: node scripts/check-neriamparampil.mjs
 */
import readline from 'readline';

const API_KEY   = 'AIzaSyAL9VnbMHttdC6lA-X3hWOQIp5KzTmc_Rw';
const PROJECT   = 'familytree-5990c';
const BASE_URL  = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

// ── helpers ─────────────────────────────────────────────────────────────────

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise(resolve => {
    process.stderr.write(question);
    rl.question('', answer => { rl.close(); resolve(answer); });
  });
}

async function firebaseSignIn(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(`Auth failed: ${data.error.message}`);
  return { idToken: data.idToken, uid: data.localId };
}

function fsGet(path, token) {
  return fetch(`${BASE_URL}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json());
}

async function fsQuery(collectionPath, token, filters = []) {
  const body = {
    structuredQuery: {
      from: [{ collectionId: collectionPath.split('/').pop() }],
      where: filters.length === 1 ? filters[0] : filters.length > 1 ? { compositeFilter: { op: 'AND', filters } } : undefined,
    },
  };
  // Use collectionGroup query from parent
  const parent = collectionPath.split('/').slice(0, -1).join('/');
  const res = await fetch(
    `https://firestore.googleapis.com/v1/${parent}:runQuery`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  return res.json();
}

// Convert Firestore value to JS
function fromFsValue(v) {
  if (v === undefined || v === null) return null;
  if (v.nullValue !== undefined) return null;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(fromFsValue);
  if (v.mapValue !== undefined) return fromFsFields(v.mapValue.fields || {});
  return v;
}

function fromFsFields(fields) {
  const obj = {};
  for (const [k, v] of Object.entries(fields)) obj[k] = fromFsValue(v);
  return obj;
}

// ── main ────────────────────────────────────────────────────────────────────

const email = 'ouseph13@gmail.com';
const password = await prompt(`Password for ${email}: `);

console.log('\n🔑  Signing in…');
const { idToken, uid } = await firebaseSignIn(email, password);
console.log(`✅  Signed in as uid=${uid}\n`);

// 1. List all family trees owned by this user
console.log('📂  Fetching family trees…');
const treesRes = await fetch(
  `${BASE_URL}/familyTrees?pageSize=50`,
  { headers: { Authorization: `Bearer ${idToken}` } }
);
const treesData = await treesRes.json();
const allDocs = treesData.documents || [];

// Filter to trees owned by this user (ownerUid field)
const userTrees = allDocs
  .filter(d => fromFsFields(d.fields || {})?.ownerUid === uid);

console.log(`   Found ${allDocs.length} total trees, ${userTrees.length} owned by ${email}`);

// 2. Find Neriamparampil tree(s)
const nTrees = userTrees.filter(d => {
  const name = (fromFsFields(d.fields || {})?.name || '').toLowerCase();
  return name.includes('neriamparampil');
});

if (nTrees.length === 0) {
  // Try checking all trees (maybe shared via invite)
  const allNTrees = allDocs.filter(d => {
    const name = (fromFsFields(d.fields || {})?.name || '').toLowerCase();
    return name.includes('neriamparampil');
  });
  if (allNTrees.length === 0) {
    console.log('❌  No Neriamparampil tree found in the database.');
    console.log('   Available trees:');
    allDocs.forEach(d => {
      const f = fromFsFields(d.fields || {});
      console.log(`     • "${f.name}" (owner: ${f.ownerUid})`);
    });
    process.exit(1);
  }
  nTrees.push(...allNTrees);
  console.log(`⚠️  Found Neriamparampil tree(s) but not owned by ${email} — may be shared.`);
}

console.log(`\n🌳  Found ${nTrees.length} Neriamparampil tree(s):\n`);

for (const treeDoc of nTrees) {
  const treeId = treeDoc.name.split('/').pop();
  const treeMeta = fromFsFields(treeDoc.fields || {});
  
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Tree ID   : ${treeId}`);
  console.log(`Name      : ${treeMeta.name}`);
  console.log(`Owner UID : ${treeMeta.ownerUid}`);
  console.log(`Members   : ${treeMeta.memberCount ?? 'N/A'}`);
  console.log(`Created   : ${treeMeta.createdAt || 'N/A'}`);
  console.log(`Updated   : ${treeMeta.updatedAt || 'N/A'}`);

  // 3. Fetch persons sub-collection
  console.log(`\n   📋  Fetching persons…`);
  const personsRes = await fetch(
    `${BASE_URL}/familyTrees/${treeId}/persons?pageSize=200`,
    { headers: { Authorization: `Bearer ${idToken}` } }
  );
  const personsData = await personsRes.json();
  const persons = (personsData.documents || []).map(d => ({
    id: d.name.split('/').pop(),
    ...fromFsFields(d.fields || {}),
  }));

  console.log(`   Total persons: ${persons.length}\n`);

  // ── Validation checks ─────────────────────────────────────────────────
  const issues = [];
  const warnings = [];

  persons.forEach((p, i) => {
    const label = `${p.name || '(unnamed)'} [${p.id}]`;

    // Required fields
    if (!p.name || p.name.trim() === '') issues.push(`${label}: missing name`);
    if (!p.gender) warnings.push(`${label}: missing gender`);

    // Date logic
    const born = p.birthDate ? new Date(p.birthDate) : null;
    const died = p.deathDate ? new Date(p.deathDate) : null;
    if (born && isNaN(born)) issues.push(`${label}: invalid birthDate "${p.birthDate}"`);
    if (died && isNaN(died)) issues.push(`${label}: invalid deathDate "${p.deathDate}"`);
    if (born && died && born > died) issues.push(`${label}: birthDate after deathDate`);

    // Relationship refs
    const allIds = new Set(persons.map(x => x.id));
    if (p.spouseIds) {
      (Array.isArray(p.spouseIds) ? p.spouseIds : [p.spouseIds]).forEach(sid => {
        if (!allIds.has(sid)) issues.push(`${label}: spouseId "${sid}" not found`);
      });
    }
    if (p.parentIds) {
      (Array.isArray(p.parentIds) ? p.parentIds : [p.parentIds]).forEach(pid => {
        if (!allIds.has(pid)) issues.push(`${label}: parentId "${pid}" not found`);
      });
    }
    if (p.childrenIds) {
      (Array.isArray(p.childrenIds) ? p.childrenIds : [p.childrenIds]).forEach(cid => {
        if (!allIds.has(cid)) issues.push(`${label}: childId "${cid}" not found`);
      });
    }
  });

  // ── Print persons table ───────────────────────────────────────────────
  console.log(`   ${'#'.padEnd(4)} ${'Name'.padEnd(30)} ${'Gender'.padEnd(8)} ${'Birth'.padEnd(12)} ${'Death'.padEnd(12)} ${'Parents'.padEnd(6)} ${'Spouse'.padEnd(6)} Children`);
  console.log(`   ${'─'.repeat(100)}`);
  persons.forEach((p, i) => {
    const parents  = (p.parentIds   || []).length;
    const spouses  = (p.spouseIds   || []).length;
    const children = (p.childrenIds || []).length;
    console.log(
      `   ${String(i + 1).padEnd(4)} ${(p.name || '').substring(0, 29).padEnd(30)} ${(p.gender || '').padEnd(8)} ${(p.birthDate || '').padEnd(12)} ${(p.deathDate || '').padEnd(12)} ${String(parents).padEnd(6)} ${String(spouses).padEnd(6)} ${children}`
    );
  });

  // ── Print validation results ──────────────────────────────────────────
  console.log(`\n   ── Validation ──────────────────────────`);
  if (issues.length === 0 && warnings.length === 0) {
    console.log(`   ✅  No issues found — all ${persons.length} person records look valid.`);
  } else {
    if (issues.length > 0) {
      console.log(`   ❌  ${issues.length} issue(s):`);
      issues.forEach(e => console.log(`        • ${e}`));
    }
    if (warnings.length > 0) {
      console.log(`   ⚠️   ${warnings.length} warning(s):`);
      warnings.forEach(w => console.log(`        • ${w}`));
    }
  }
  console.log('');
}
