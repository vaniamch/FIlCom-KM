import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase/config';
import { UserProfile, UserRole } from '../types';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const ensureUserProfileDocument = async (fbUser: FirebaseUser): Promise<UserProfile> => {
    const userDocRef = doc(db, 'users', fbUser.uid);
    const isMaster = fbUser.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();

    try {
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const raw = snap.data() as UserProfile;
        const normalized: UserProfile = {
          ...raw,
          status: raw.status || 'active',
        };

        if (isMaster && (normalized.role !== 'admin' || normalized.status !== 'active')) {
          await updateDoc(userDocRef, {
            role: 'admin',
            status: 'active',
            updatedAt: new Date().toISOString(),
          });
          await setDoc(doc(db, 'admins', fbUser.uid), {
            uid: fbUser.uid,
            email: fbUser.email || '',
            grantedAt: new Date().toISOString(),
          });
          normalized.role = 'admin';
          normalized.status = 'active';
        } else if (!raw.status) {
          await updateDoc(userDocRef, {
            status: 'active',
            updatedAt: new Date().toISOString(),
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
        });
      }
      setAuthError(null);
      setUserProfile(newProfile);
      return newProfile;
    } catch (err) {
      console.error('Failed to fetch/create user profile:', err);
      const fallbackRole: UserRole = isMaster ? 'admin' : 'member';
      const fallback: UserProfile = {
        id: fbUser.uid,
        email: fbUser.email || '',
        displayName: fbUser.displayName || 'Student User',
        role: fallbackRole,
        status: 'active',
        department: 'Student Organization',
        createdAt: new Date().toISOString(),
      };
      setUserProfile(fallback);
      return fallback;
    }
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      setCurrentUser(user);

      if (user) {
        await ensureUserProfileDocument(user);

        // Real-time listener so Admin role/status changes take effect immediately
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeProfile = onSnapshot(
          userDocRef,
          (snap) => {
            if (snap.exists()) {
              const data = snap.data() as UserProfile;
              const normalized: UserProfile = {
                ...data,
                status: data.status || 'active',
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
      } else {
        setUserProfile(null);
        setAuthError(null);
      }

      setLoading(false);
    });

    return () => {
      if (unsubscribeProfile) unsubscribeProfile();
      unsubscribeAuth();
    };
  }, []);

  const loginWithGoogle = async () => {
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        const profile = await ensureUserProfileDocument(result.user);
        if (profile.status === 'inactive') {
          throw new Error('Your account has been deactivated by an administrator.');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
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
      await ensureUserProfileDocument(currentUser);
    }
  };

  const isDeactivated = !!currentUser && userProfile?.status === 'inactive';
  const isActive = !!currentUser && !isDeactivated;
  const effectiveRole: UserRole = userProfile?.role || 'member';

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
