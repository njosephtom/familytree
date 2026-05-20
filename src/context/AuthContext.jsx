import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth, googleProvider, firebaseInitError } from '../firebase';
import { createOrUpdateUser } from '../utils/firestoreService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!firebaseInitError);

  useEffect(() => {
    if (firebaseInitError || !auth) {
      setLoading(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await createOrUpdateUser(firebaseUser);
        setUser(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signInWithEmail(email, password) {
    if (!auth) throw firebaseInitError || new Error('Firebase is not configured.');
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  }

  async function signUpWithEmail(email, password, displayName) {
    if (!auth) throw firebaseInitError || new Error('Firebase is not configured.');
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    await createOrUpdateUser({ ...cred.user, displayName });
    return cred.user;
  }

  async function signInWithGoogle() {
    if (!auth || !googleProvider) throw firebaseInitError || new Error('Firebase is not configured.');
    const cred = await signInWithPopup(auth, googleProvider);
    await createOrUpdateUser(cred.user);
    return cred.user;
  }

  async function logOut() {
    if (!auth) throw firebaseInitError || new Error('Firebase is not configured.');
    await signOut(auth);
  }

  async function resetPassword(email) {
    if (!auth) throw firebaseInitError || new Error('Firebase is not configured.');
    await sendPasswordResetEmail(auth, email);
  }

  return (
    <AuthContext.Provider value={{ user, loading, firebaseInitError, signInWithEmail, signUpWithEmail, signInWithGoogle, logOut, resetPassword }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
