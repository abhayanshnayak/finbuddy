import { useState, useEffect, useCallback, useRef } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  auth,
  googleProvider,
  facebookProvider,
  isFirebaseConfigured,
} from '../firebase';
import {
  AuthContext,
  normalizeFirebaseUser,
  formatAuthError,
} from './authStore';
import SignInModal from '../components/auth/SignInModal';

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [signingInProvider, setSigningInProvider] = useState(null);
  const [authError, setAuthError] = useState('');
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const [signInPromptReason, setSignInPromptReason] = useState('');
  const syncedUidRef = useRef(null);

  const syncUserWithBackend = useCallback(async (firebaseUser) => {
    if (!firebaseUser || syncedUidRef.current === firebaseUser.uid) return;
    syncedUidRef.current = firebaseUser.uid;
    try {
      const token = await firebaseUser.getIdToken();
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      await fetch(`${apiBase}/api/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Best-effort profile sync: backend being offline must not disrupt optional sign-in
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(normalizeFirebaseUser(firebaseUser));
        syncUserWithBackend(firebaseUser);
      } else {
        syncedUidRef.current = null;
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [syncUserWithBackend]);

  const openSignInModal = useCallback((reason = '') => {
    setAuthError('');
    setSignInPromptReason(typeof reason === 'string' ? reason : '');
    setSignInModalOpen(true);
  }, []);

  const closeSignInModal = useCallback(() => {
    setSignInModalOpen(false);
    setAuthError('');
    setSignInPromptReason('');
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError('');
  }, []);

  const signInWithProvider = useCallback(async (provider, providerKey, providerLabel) => {
    if (!isFirebaseConfigured || !auth) {
      setAuthError(
        'Authentication is not configured in this environment. Set VITE_FIREBASE_* environment variables to enable sign-in.'
      );
      return null;
    }

    setAuthError('');
    setSigningInProvider(providerKey);

    try {
      const result = await signInWithPopup(auth, provider);
      const normalized = normalizeFirebaseUser(result.user);
      setUser(normalized);
      setSignInModalOpen(false);
      setSignInPromptReason('');
      syncUserWithBackend(result.user);
      return normalized;
    } catch (err) {
      const message = formatAuthError(err, providerLabel);
      if (message) {
        setAuthError(message);
      }
      return null;
    } finally {
      setSigningInProvider(null);
    }
  }, [syncUserWithBackend]);

  const signInWithGoogle = useCallback(
    () => signInWithProvider(googleProvider, 'google', 'Google'),
    [signInWithProvider]
  );

  const signInWithFacebook = useCallback(
    () => signInWithProvider(facebookProvider, 'facebook', 'Facebook'),
    [signInWithProvider]
  );

  const signOut = useCallback(async () => {
    if (!auth) return;
    try {
      await firebaseSignOut(auth);
      syncedUidRef.current = null;
      setUser(null);
      setAuthError('');
    } catch (err) {
      setAuthError(err?.message || 'Unable to sign out. Please try again.');
    }
  }, []);

  const getIdToken = useCallback(async (forceRefresh = false) => {
    if (!auth?.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken(forceRefresh);
    } catch {
      return null;
    }
  }, []);

  const authFetch = useCallback(
    async (url, options = {}) => {
      const token = await getIdToken();
      const headers = new Headers(options.headers || {});
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return fetch(url, { ...options, headers });
    },
    [getIdToken]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user),
        authConfigured: isFirebaseConfigured,
        signingInProvider,
        authError,
        signInModalOpen,
        signInPromptReason,
        openSignInModal,
        closeSignInModal,
        clearAuthError,
        signInWithGoogle,
        signInWithFacebook,
        signOut,
        getIdToken,
        authFetch,
      }}
    >
      {children}
      <SignInModal />
    </AuthContext.Provider>
  );
}
