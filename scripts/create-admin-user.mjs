/**
 * Creates admin@familytree.com in Firebase Auth and marks it as admin in Firestore.
 * Run: node scripts/create-admin-user.mjs
 *
 * Safe to run multiple times — signs in if the account already exists.
 */
const API_KEY  = 'AIzaSyAL9VnbMHttdC6lA-X3hWOQIp5KzTmc_Rw';
const PROJECT  = 'familytree-5990c';
const FS_BASE  = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const ADMIN_EMAIL    = 'admin@familytree.com';
const ADMIN_PASSWORD = 'AdminFamilyTree2026!';
const ADMIN_NAME     = 'Admin';

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// 1. Try to create the account; fall back to sign-in if it already exists
console.log(`Creating / signing in as ${ADMIN_EMAIL}…`);
let data = await post(
  `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
  { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, returnSecureToken: true },
);

if (data.error?.message === 'EMAIL_EXISTS') {
  console.log('  Account already exists — signing in…');
  data = await post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, returnSecureToken: true },
  );
}

if (data.error) {
  console.error('Firebase error:', data.error.message);
  process.exit(1);
}

const { localId: uid, idToken: token } = data;
console.log(`✅  UID: ${uid}`);

// 2. Update display name
await post(
  `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`,
  { idToken: token, displayName: ADMIN_NAME },
);
console.log('✅  Display name set to "Admin"');

// 3. Write / update the Firestore user document with isAdmin: true
const fsBody = {
  fields: {
    uid:          { stringValue: uid },
    email:        { stringValue: ADMIN_EMAIL },
    displayName:  { stringValue: ADMIN_NAME },
    isAdmin:      { booleanValue: true },
    familyTreeIds: { arrayValue: { values: [] } },
  },
};

const fsRes = await fetch(
  `${FS_BASE}/users/${uid}`,
  {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(fsBody),
  },
);
const fsData = await fsRes.json();
if (fsData.error) {
  console.error('Firestore error:', fsData.error.message);
  process.exit(1);
}
console.log('✅  Firestore user document created / updated (isAdmin: true)');

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Admin account ready:');
console.log(`  Email    : ${ADMIN_EMAIL}`);
console.log(`  Password : ${ADMIN_PASSWORD}`);
console.log(`  UID      : ${uid}`);
console.log('\nLog in at http://localhost:3000 — the user menu will');
console.log('show a "🛡 Admin Panel" link that lists all family trees.');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
