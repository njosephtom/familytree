/**
 * Deletes ALL Firestore data for a given user account.
 * Run: node scripts/reset-db.mjs
 * You will be prompted for the password in the terminal.
 */
import readline from 'readline';

const API_KEY  = 'AIzaSyAL9VnbMHttdC6lA-X3hWOQIp5KzTmc_Rw';
const PROJECT  = 'familytree-5990c';
const FS_BASE  = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

// ── helpers ──────────────────────────────────────────────────────────────────

function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise(r => { process.stderr.write(q); rl.question('', a => { rl.close(); r(a); }); });
}

async function signIn(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }) }
  );
  const d = await res.json();
  if (d.error) throw new Error(`Auth failed: ${d.error.message}`);
  return { token: d.idToken, uid: d.localId };
}

function fromFsValue(v) {
  if (!v) return null;
  if (v.stringValue  !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.arrayValue   !== undefined) return (v.arrayValue.values || []).map(fromFsValue);
  if (v.mapValue     !== undefined) return fromFsFields(v.mapValue.fields || {});
  return null;
}
function fromFsFields(f) {
  const o = {};
  for (const [k, v] of Object.entries(f)) o[k] = fromFsValue(v);
  return o;
}

async function listDocs(path, token) {
  const docs = [];
  let pageToken = '';
  do {
    const url = `${FS_BASE}/${path}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.documents) docs.push(...data.documents);
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return docs;
}

async function deleteDoc(docName, token) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/${docName}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  );
  return res.status;
}

// ── main ─────────────────────────────────────────────────────────────────────

const email    = 'ouseph13@gmail.com';
const password = await prompt(`Password for ${email}: `);
console.log('');

console.log('🔑  Signing in…');
const { token, uid } = await signIn(email, password);
console.log(`✅  Signed in  uid=${uid}\n`);

// 1. Get all family trees (the collection is not scoped by UID — we filter)
console.log('📂  Listing familyTrees…');
const allTrees = await listDocs('familyTrees', token);
const myTrees  = allTrees.filter(d => {
  const f = fromFsFields(d.fields || {});
  // owned by this user OR in memberUids list
  return f.ownerUid === uid || (Array.isArray(f.memberUids) && f.memberUids.includes(uid));
});
console.log(`   Total trees in collection : ${allTrees.length}`);
console.log(`   Trees belonging to user   : ${myTrees.length}\n`);

if (myTrees.length === 0) {
  console.log('Nothing to delete — exiting.');
  process.exit(0);
}

// 2. Delete each tree's sub-collections then the tree doc itself
let totalPersonsDeleted = 0;
let totalTreesDeleted   = 0;

for (const treeDoc of myTrees) {
  const treeId   = treeDoc.name.split('/').pop();
  const treeMeta = fromFsFields(treeDoc.fields || {});
  console.log(`🌳  Tree: "${treeMeta.name || treeId}"  (${treeId})`);

  // Delete persons
  const persons = await listDocs(`familyTrees/${treeId}/persons`, token);
  process.stdout.write(`   Deleting ${persons.length} person(s)… `);
  for (const p of persons) {
    await deleteDoc(p.name, token);
    totalPersonsDeleted++;
  }
  console.log('done');

  // Delete invites sub-collection if present
  const invites = await listDocs(`familyTrees/${treeId}/invites`, token);
  if (invites.length > 0) {
    process.stdout.write(`   Deleting ${invites.length} invite(s)… `);
    for (const inv of invites) await deleteDoc(inv.name, token);
    console.log('done');
  }

  // Delete presence sub-collection if present
  const presence = await listDocs(`familyTrees/${treeId}/presence`, token);
  if (presence.length > 0) {
    process.stdout.write(`   Deleting ${presence.length} presence record(s)… `);
    for (const pr of presence) await deleteDoc(pr.name, token);
    console.log('done');
  }

  // Delete the tree document itself
  const status = await deleteDoc(treeDoc.name, token);
  console.log(`   Deleted tree document  (HTTP ${status})`);
  totalTreesDeleted++;
  console.log('');
}

// 3. Clean up top-level invites collection (invites addressed to this user's email)
console.log('📧  Checking top-level invites collection…');
const allInvites = await listDocs('invites', token);
const myInvites  = allInvites.filter(d => {
  const f = fromFsFields(d.fields || {});
  return f.invitedEmail === email || f.invitedByUid === uid;
});
if (myInvites.length > 0) {
  process.stdout.write(`   Deleting ${myInvites.length} invite(s)… `);
  for (const inv of myInvites) await deleteDoc(inv.name, token);
  console.log('done');
} else {
  console.log('   None found.');
}

// 4. Clean up user document
console.log('\n👤  Deleting user document…');
const userDelStatus = await deleteDoc(
  `projects/${PROJECT}/databases/(default)/documents/users/${uid}`, token
);
console.log(`   HTTP ${userDelStatus}`);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`✅  Reset complete`);
console.log(`   Trees deleted   : ${totalTreesDeleted}`);
console.log(`   Persons deleted : ${totalPersonsDeleted}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\nRefresh http://localhost:3000 to start fresh.');
