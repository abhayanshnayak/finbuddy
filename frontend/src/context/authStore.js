import { createContext, useContext } from 'react';

export const AuthContext = createContext({
  user: null,
  loading: false,
  isAuthenticated: false,
  authConfigured: false,
  signingInProvider: null,
  authError: '',
  signInModalOpen: false,
  signInPromptReason: '',
  openSignInModal: () => {},
  closeSignInModal: () => {},
  clearAuthError: () => {},
  signInWithGoogle: async () => null,
  signInWithFacebook: async () => null,
  signOut: async () => {},
  getIdToken: async () => null,
  authFetch: async (url, options) => fetch(url, options),
});

export function useAuth() {
  return useContext(AuthContext);
}

export function getProviderLabel(providerId) {
  if (providerId === 'google.com') return 'Google';
  if (providerId === 'facebook.com') return 'Facebook';
  return 'Account';
}

export function getInitials(name) {
  const cleaned = (name || '').trim();
  if (!cleaned) return 'U';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export function normalizeFirebaseUser(firebaseUser) {
  if (!firebaseUser) return null;

  const providerList = Array.isArray(firebaseUser.providerData)
    ? firebaseUser.providerData
    : [];
  const primaryProvider =
    providerList.find((p) => p?.providerId === 'google.com' || p?.providerId === 'facebook.com') ||
    providerList[0] ||
    null;

  const email =
    firebaseUser.email ||
    providerList.find((p) => p?.email)?.email ||
    '';

  const rawName =
    firebaseUser.displayName?.trim() ||
    providerList.find((p) => p?.displayName)?.displayName?.trim() ||
    (email ? email.split('@')[0] : '') ||
    'Signed-in User';

  const photoURL =
    firebaseUser.photoURL ||
    providerList.find((p) => p?.photoURL)?.photoURL ||
    null;

  const providerId = primaryProvider?.providerId || '';
  const firstName = rawName.split(/\s+/)[0] || rawName;

  return {
    uid: firebaseUser.uid,
    displayName: rawName,
    firstName,
    initials: getInitials(rawName),
    email,
    photoURL,
    providerId,
    providerLabel: getProviderLabel(providerId),
    emailVerified: Boolean(firebaseUser.emailVerified),
  };
}

export function formatAuthError(error, providerLabel) {
  const code = error?.code || '';
  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request'
  ) {
    return '';
  }
  if (code === 'auth/popup-blocked') {
    return `Your browser blocked the ${providerLabel} sign-in popup. Please allow popups for this site and try again.`;
  }
  if (code === 'auth/unauthorized-domain') {
    return `This domain (${window.location.hostname}) is not authorized in Firebase Authentication settings yet.`;
  }
  if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') {
    if (providerLabel === 'Facebook') {
      return 'Facebook sign-in is not yet enabled in Firebase Console. Enable the Facebook provider with your Meta App ID and App Secret under Authentication → Sign-in method.';
    }
    return `${providerLabel} sign-in is not enabled in Firebase Console under Authentication → Sign-in method.`;
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'An account already exists with the same email address using a different sign-in provider. Sign in with your original provider instead.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error while contacting the sign-in service. Check your connection and try again.';
  }
  return error?.message || `Unable to sign in with ${providerLabel}. Please try again.`;
}
