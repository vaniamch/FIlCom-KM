import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase/config';
import { UserProfile, UserRole, UserStatus } from '../types';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isActive: boolean;
  isDeactivated: boolean;
  authError: string | null;
  isAdmin: boolean;
  isEditor: boolean;
  isMember: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const MASTER_ADMIN_EMAIL = '12410288@student.unklab.ac.id';

export function normalizeUserRole(rawRole: unknown, isMaster: boolean = false): UserRole {
  if (isMaster) return 'admin';
  const value = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : '';
  if (value === 'admin' || value === 'editor' || value === 'member') {
    return value;
  }
  return 'member';
}

export function normalizeUserStatus(rawStatus: unknown, isMaster: boolean = false): UserStatus {
  if (isMaster) return 'active';
  const value = typeof rawStatus === 'string' ? rawStatus.trim().toLowerCase() : '';
  if (value === 'inactive') return 'inactive';
  return 'active';
}

async function fetchUserDocFresh(userDocRef: ReturnType<typeof doc>) {
  try {
    return await getDocFromServer(userDocRef);
  } catch (err: any) {
    const code = String(err?.code || '').toLowerCase();
    const message = String(err?.message || '').toLowerCase();
    if (code === 'unavailable' || message.includes('offline')) {
      return await getDoc(userDocRef);
    }
    throw err;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const ensureUserProfileDocument = async (
    fbUser: FirebaseUser,
    options?: { forceTokenRefresh?: boolean }
  ): Promise<UserProfile | null> => {
    const userDocRef = doc(db, 'users', fbUser.uid);
    const isMaster = fbUser.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();

    try {
      if (options?.forceTokenRefresh) {
        await fbUser.getIdToken(true).catch(() => {});
      }

      const snap = await fetchUserDocFresh(userDocRef);
      if (auth.currentUser?.uid && auth.currentUser.uid !== fbUser.uid) {
        return null;
      }

      if (snap.exists()) {
        const raw = snap.data() as Partial<UserProfile>;
        const normalizedRole = normalizeUserRole(raw.role, isMaster);
        const normalizedStatus = normalizeUserStatus(raw.status, isMaster);

        const normalized: UserProfile = {
          ...raw,
          id: raw.id || fbUser.uid,
          email: raw.email || fbUser.email || '',
          displayName:
            raw.displayName || fbUser.displayName || fbUser.email?.split('@')[0] || 'Student Member',
          role: normalizedRole,
          status: normalizedStatus,
          department: raw.department,
          photoURL: raw.photoURL,
          createdAt: raw.createdAt || new Date().toISOString(),
          updatedAt: raw.updatedAt,
        };

        if (isMaster && (raw.role !== 'admin' || raw.status !== 'active')) {
          await updateDoc(userDocRef, {
            role: 'admin',
            status: 'active',
            updatedAt: new Date().toISOString(),
          }).catch(() => {});
          await setDoc(doc(db, 'admins', fbUser.uid), {
            uid: fbUser.uid,
            email: fbUser.email || '',
            grantedAt: new Date().toISOString(),
          }).catch(() => {});
        } else if (!raw.status) {
          await updateDoc(userDocRef, {
            status: 'active',
            updatedAt: new Date().toISOString(),
          }).catch(() => {});
        }

        if (normalizedRole === 'admin' && normalizedStatus === 'active') {
          await setDoc(doc(db, 'admins', fbUser.uid), {
            uid: fbUser.uid,
            email: normalized.email,
            updated: new Date().toISOString(),
          }).catch(() => {});
        }

        if (normalized.status === 'inactive') {
          setAuthError('Your account has been deactivated by an administrator.');
        } else {
          setAuthError(null);
        }

        setUserProfile(normalized);
        return normalized;
      }

      const initialRole: UserRole = isMaster ? 'admin' : 'member';
      const now = new Date().toISOString();
      const newProfile: UserProfile = {
        id: fbUser.uid,
        email: fbUser.email || '',
        displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Student Member',
        role: initialRole,
        status: 'active',
        department: isMaster ? 'Executive Board' : 'General Assembly',
        photoURL: fbUser.photoURL || '',
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(userDocRef, newProfile);
      if (isMaster) {
        await setDoc(doc(db, 'admins', fbUser.uid), {
          uid: fbUser.uid,
          email: fbUser.email || '',
          grantedAt: now,
        }).catch(() => {});
      }
      setAuthError(null);
      setUserProfile(newProfile);
      return newProfile;
    } catch (err: any) {
      console.error('Failed to fetch/create user profile:', err);
      setAuthError(
        err?.message ||
          'Unable to verify your user role from Firestore. Please check your connection and sign in again.'
      );
      setUserProfile(null);
      return null;
    }
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let isMounted = true;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (!isMounted) return;

      if (user) {
        setLoading(true);
        setCurrentUser(user);
        const resolved = await ensureUserProfileDocument(user);
        if (!isMounted || auth.currentUser?.uid !== user.uid) return;

        // Real-time listener so Admin role/status changes take effect immediately
        const userDocRef = doc(db, 'users', user.uid);
        let hasServerProfile = !!resolved;

        unsubscribeProfile = onSnapshot(
          userDocRef,
          (snap) => {
            if (!isMounted) return;
            // Prevent initial stale IndexedDB cache snapshot from overwriting a freshly fetched server profile
            if (snap.metadata.fromCache && hasServerProfile) {
              return;
            }
            if (!snap.metadata.fromCache) {
              hasServerProfile = true;
            }

            if (snap.exists()) {
              const raw = snap.data() as Partial<UserProfile>;
              const isMaster = user.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
              const normalized: UserProfile = {
                ...raw,
                id: raw.id || user.uid,
                email: raw.email || user.email || '',
                displayName:
                  raw.displayName || user.displayName || user.email?.split('@')[0] || 'Student Member',
                role: normalizeUserRole(raw.role, isMaster),
                status: normalizeUserStatus(raw.status, isMaster),
                department: raw.department,
                photoURL: raw.photoURL,
                createdAt: raw.createdAt || new Date().toISOString(),
                updatedAt: raw.updatedAt,
              };
              setUserProfile(normalized);
              if (normalized.status === 'inactive') {
                setAuthError('Your account has been deactivated by an administrator.');
              } else {
                setAuthError(null);
              }
            }
          },
          (err) => {
            console.warn('User profile listener warning:', err);
          }
        );

        if (isMounted) {
          setLoading(false);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setAuthError(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      if (unsubscribeProfile) unsubscribeProfile();
      unsubscribeAuth();
    };
  }, []);

  const loginWithGoogle = async () => {
    setAuthError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        const profile = await ensureUserProfileDocument(result.user, {
          forceTokenRefresh: true,
        });
        if (!profile) {
          throw new Error(
            'Unable to verify your user role from Firestore. Please try signing in again.'
          );
        }
        if (profile.status === 'inactive') {
          throw new Error('Your account has been deactivated by an administrator.');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      setCurrentUser(null);
      setUserProfile(null);
      setAuthError(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!currentUser || !userProfile) return;
    if (userProfile.status === 'inactive') {
      throw new Error('Deactivated accounts cannot update profile settings.');
    }

    const userDocRef = doc(db, 'users', currentUser.uid);
    try {
      // Strictly strip immutable/privileged fields on self-update
      const safePatch: Partial<UserProfile> = {};
      if (data.displayName !== undefined) safePatch.displayName = data.displayName;
      if (data.department !== undefined) safePatch.department = data.department;
      if (data.photoURL !== undefined) safePatch.photoURL = data.photoURL;

      const updated = {
        ...safePatch,
        updatedAt: new Date().toISOString(),
      };
      await updateDoc(userDocRef, updated);
      setUserProfile((prev) => (prev ? { ...prev, ...updated } : null));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${currentUser.uid}`);
    }
  };

  const refreshUserProfile = async () => {
    if (currentUser) {
      await ensureUserProfileDocument(currentUser, { forceTokenRefresh: true });
    }
  };

  const isMasterCurrent =
    currentUser?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
  const isDeactivated = !!currentUser && userProfile?.status === 'inactive';
  const isActive = !!currentUser && !!userProfile && !isDeactivated;
  const effectiveRole: UserRole = userProfile
    ? normalizeUserRole(userProfile.role, isMasterCurrent)
    : 'member';

  const isAdmin = isActive && effectiveRole === 'admin';
  const isEditor = isActive && (effectiveRole === 'editor' || effectiveRole === 'admin');
  const isMember = isActive;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        isActive,
        isDeactivated,
        authError,
        isAdmin,
        isEditor,
        isMember,
        loginWithGoogle,
        logout,
        updateProfile,
        refreshUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
