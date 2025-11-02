import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

type AuthStatus = 'initializing' | 'ready' | 'signingIn' | 'signedIn';

export type AppUser = {
  uid: string;
  name: string;
  email: string;
  avatarUrl?: string;
};

type AuthState = {
  status: AuthStatus;
  user: AppUser | null;
  error: string | null;
};

type AuthContextValue = {
  status: AuthStatus;
  user: AppUser | null;
  error: string | null;
  isReady: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const buildInitialState = (): AuthState => ({
  status: 'initializing',
  user: null,
  error: null
});

const mapFirebaseUser = (user: FirebaseUser): AppUser => ({
  uid: user.uid,
  name: user.displayName ?? user.email ?? 'Unknown User',
  email: user.email ?? '',
  avatarUrl: user.photoURL ?? undefined
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<AuthState>(buildInitialState);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        if (firebaseUser) {
          setState({
            status: 'signedIn',
            user: mapFirebaseUser(firebaseUser),
            error: null
          });
        } else {
          setState({
            status: 'ready',
            user: null,
            error: null
          });
        }
      },
      (error) => {
        console.error('Auth state change error', error);
        setState({
          status: 'ready',
          user: null,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      status: 'signingIn',
      error: null
    }));

    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (!result.user) {
        throw new Error('Google サインインに失敗しました');
      }
      setState({
        status: 'signedIn',
        user: mapFirebaseUser(result.user),
        error: null
      });
    } catch (error) {
      console.error('Failed to sign in with Google', error);
      setState({
        status: 'ready',
        user: null,
        error: error instanceof Error ? error.message : 'Google サインインに失敗しました'
      });
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      setState({
        status: 'ready',
        user: null,
        error: null
      });
    } catch (error) {
      console.error('Failed to sign out', error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'サインアウトに失敗しました'
      }));
      throw error;
    }
  }, []);

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.user,
      error: state.error,
      isReady: state.status === 'ready' || state.status === 'signedIn',
      signInWithGoogle,
      signOut
    }),
    [signInWithGoogle, signOut, state.error, state.status, state.user]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth は AuthProvider 内でのみ利用できます');
  }
  return value;
};
