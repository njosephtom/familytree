import {
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  query,
  where,
  getDocs,
  deleteField,
  onSnapshot,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

// ── Users ─────────────────────────────────────────────────────────────────────

export async function createOrUpdateUser(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid:          user.uid,
      displayName:  user.displayName || '',
      email:        user.email || '',
      photoURL:     user.photoURL || '',
      familyTreeIds: [],
      createdAt:    serverTimestamp(),
    });
  } else {
    await updateDoc(ref, {
      displayName: user.displayName || snap.data().displayName || '',
      email:       user.email || snap.data().email || '',
      photoURL:    user.photoURL || snap.data().photoURL || '',
    });
  }
}

export async function getUser(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

// ── Family Trees ──────────────────────────────────────────────────────────────

export async function createFamilyTree(uid, name) {
  const treeRef = await addDoc(collection(db, 'familyTrees'), {
    name,
    createdBy: uid,
    members:   { [uid]: { role: 'owner', joinedAt: serverTimestamp() } },
    persons:   [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  // Add treeId to user's familyTreeIds
  await updateDoc(doc(db, 'users', uid), {
    familyTreeIds: arrayUnion(treeRef.id),
  });
  return treeRef.id;
}

export async function getFamilyTree(treeId) {
  // Use getDocFromServer to bypass in-memory cache and ensure fresh data after imports/edits
  const snap = await getDocFromServer(doc(db, 'familyTrees', treeId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getUserFamilyTrees(uid) {
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (!userSnap.exists()) return [];
  const ids = userSnap.data().familyTreeIds || [];
  const trees = await Promise.all(ids.map((id) => getFamilyTree(id)));
  return trees.filter(Boolean);
}

export async function saveFamilyTreePersons(treeId, persons) {
  // Strip base64 photo data before saving — Firestore has a 1 MiB document limit.
  // Large photos must be stored in Firebase Storage instead. Photos remain visible
  // in the current session (held in React state) but will not survive a reload.
  const safePersons = persons.map((person) => {
    const { photo, ...rest } = person;
    const base = photo && photo.length > 50_000 ? rest : { ...rest, ...(photo !== undefined ? { photo } : {}) };

    // Firestore rejects undefined values, so drop any undefined fields.
    return Object.fromEntries(Object.entries(base).filter(([, value]) => value !== undefined));
  });
  await updateDoc(doc(db, 'familyTrees', treeId), {
    persons: safePersons,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFamilyTree(treeId, ownerUid) {
  // Remove from owner's tree list and wipe saved layout
  await updateDoc(doc(db, 'users', ownerUid), {
    familyTreeIds: arrayRemove(treeId),
    [`treeLayouts.${treeId}`]: deleteField(),
  });
  // Delete the tree document itself
  await deleteDoc(doc(db, 'familyTrees', treeId));
}

// ── Invites ───────────────────────────────────────────────────────────────────

export async function createInvite(treeId, treeName, invitedByUid, invitedByName, invitedEmail) {
  const ref = await addDoc(collection(db, 'invites'), {
    treeId,
    treeName,
    invitedBy:     invitedByUid,
    invitedByName,
    invitedEmail:  invitedEmail.toLowerCase(),
    status:        'pending',
    createdAt:     serverTimestamp(),
  });
  return ref.id;
}

export async function getInvite(inviteId) {
  const snap = await getDoc(doc(db, 'invites', inviteId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getPendingInvitesByEmail(email) {
  const q = query(
    collection(db, 'invites'),
    where('invitedEmail', '==', email.toLowerCase()),
    where('status', '==', 'pending'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function acceptInvite(inviteId, uid) {
  const invite = await getInvite(inviteId);
  if (!invite || invite.status !== 'pending') return;

  // Add user to family tree members
  await updateDoc(doc(db, 'familyTrees', invite.treeId), {
    [`members.${uid}`]: { role: 'member', joinedAt: serverTimestamp() },
  });

  // Add tree to user's list
  await updateDoc(doc(db, 'users', uid), {
    familyTreeIds: arrayUnion(invite.treeId),
  });

  // Mark invite as accepted
  await updateDoc(doc(db, 'invites', inviteId), { status: 'accepted' });
}

export async function declineInvite(inviteId) {
  await updateDoc(doc(db, 'invites', inviteId), { status: 'declined' });
}

export async function getTreeInvites(treeId) {
  const q = query(collection(db, 'invites'), where('treeId', '==', treeId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── Presence ─────────────────────────────────────────────────────────────────
// Stored at familyTrees/{treeId}/presence/{uid}

export function subscribeToTreePresence(treeId, callback) {
  const ref = collection(db, 'familyTrees', treeId, 'presence');
  return onSnapshot(
    ref,
    (snap) => {
      const now = Date.now();
      const users = snap.docs
        .map((d) => ({ uid: d.id, ...d.data() }))
        .filter((u) => now - (u.lastSeen || 0) < 90_000);
      callback(users);
    },
    () => callback([]),
  );
}

export async function setUserPresence(treeId, uid, data) {
  await setDoc(
    doc(db, 'familyTrees', treeId, 'presence', uid),
    { uid, ...data, lastSeen: Date.now() },
    { merge: true },
  );
}

export async function clearUserPresence(treeId, uid) {
  await deleteDoc(doc(db, 'familyTrees', treeId, 'presence', uid));
}

// ── User tree layouts ─────────────────────────────────────────────────────────
// Stored at users/{uid}.treeLayouts.{treeId} = { pos, pan, zoom, savedAt }

export async function saveUserTreeLayout(uid, treeId, layout) {
  await updateDoc(doc(db, 'users', uid), {
    [`treeLayouts.${treeId}`]: { ...layout, savedAt: Date.now() },
  });
}

export async function getUserTreeLayout(uid, treeId) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return snap.data()?.treeLayouts?.[treeId] ?? null;
}

// ── Admin utilities ───────────────────────────────────────────────────────────
// Only callable from the admin@familytree.com account.

export async function getAllFamilyTrees() {
  const snap = await getDocs(collection(db, 'familyTrees'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
