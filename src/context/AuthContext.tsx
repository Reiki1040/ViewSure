import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { decodeGoogleCredential, loadGoogleIdentityServices } from '../utils/googleIdentity';

type AuthStatus = 'initializing' | 'ready' | 'signingIn' | 'signedIn';

export type GoogleUserProfile = {
  id: string;
  name: string;
  email: string;
  picture?: string;
  givenName?: string;
  familyName?: string;
};

type AuthState = {
  status: AuthStatus;
  user: GoogleUserProfile | null;
  error: string | null;
};

type AuthContextValue = {
  status: AuthStatus;
  user: GoogleUserProfile | null;
  error: string | null;
  isReady: boolean;
  signInWithGoogle: () => Promise<GoogleUserProfile>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'viewsure.google.credential';

const buildInitialState = (): AuthState => ({
  status: 'initializing',
  user: null,
  error: null
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<AuthState>(buildInitialState);
  const hasInitializedRef = useRef(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    const restoreSession = () => {
      const savedCredential = window.localStorage.getItem(STORAGE_KEY);
      if (!savedCredential) {
        setState({ status: clientId ? 'ready' : 'initializing', user: null, error: null });
        return;
      }
      try {
        const profile = decodeGoogleCredential(savedCredential);
        setState({ status: 'signedIn', user: profile, error: null });
      } catch (error) {
        console.warn('Failed to decode stored Google credential', error);
        window.localStorage.removeItem(STORAGE_KEY);
        setState({ status: clientId ? 'ready' : 'initializing', user: null, error: null });
      }
    };

    restoreSession();
  }, [clientId]);

  useEffect(() => {
    if (!clientId) {
      setState((prev) => ({
        ...prev,
        status: 'initializing',
        error: 'VITE_GOOGLE_CLIENT_ID が設定されていません'
      }));
      return;
    }

    let cancelled = false;
    loadGoogleIdentityServices()
      .then(() => {
        if (cancelled) {
          return;
        }
        setState((prev) => ({
          ...prev,
          status: prev.user ? 'signedIn' : 'ready',
          error: null
        }));
      })
      .catch((error) => {
        console.error('Failed to load Google Identity Services', error);
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            status: 'initializing',
            error: 'Google サインイン用のスクリプトの読み込みに失敗しました'
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const signInWithGoogle = useCallback(async (): Promise<GoogleUserProfile> => {
    if (!clientId) {
      throw new Error('VITE_GOOGLE_CLIENT_ID が設定されていません');
    }

    await loadGoogleIdentityServices();

    if (!window.google?.accounts?.id) {
      throw new Error('Google Identity Services が初期化されていません');
    }

    setState((prev) => ({
      ...prev,
      status: 'signingIn',
      error: null
    }));

    return new Promise<GoogleUserProfile>((resolve, reject) => {
      const handleCredential = (response: google.accounts.id.CredentialResponse) => {
        if (!response.credential) {
          setState((prev) => ({
            ...prev,
            status: prev.user ? 'signedIn' : 'ready',
            error: 'サインインに失敗しました'
          }));
          reject(new Error('Credential response did not contain a token.'));
          return;
        }

        try {
          const profile = decodeGoogleCredential(response.credential);
          window.localStorage.setItem(STORAGE_KEY, response.credential);
          setState({
            status: 'signedIn',
            user: profile,
            error: null
          });
          resolve(profile);
        } catch (error) {
          console.error('Failed to decode Google credential', error);
          setState({
            status: 'ready',
            user: null,
            error: 'Google アカウント情報の解析に失敗しました'
          });
          reject(error instanceof Error ? error : new Error('Failed to decode Google credential'));
        }
      };

      if (!hasInitializedRef.current) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
          prompt_parent_id: 'google-signin-parent'
        });
        hasInitializedRef.current = true;
      } else {
        // update callback to latest closure
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
          prompt_parent_id: 'google-signin-parent'
        });
      }

      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          const reason =
            notification.getNotDisplayedReason?.() ??
            (notification.isSkippedMoment() ? notification.getSkippedReason?.() : null);
          const message = reason ? `Google サインインが完了しませんでした (${reason})` : 'Google サインインが完了しませんでした';
          setState((prev) => ({
            ...prev,
            status: prev.user ? 'signedIn' : 'ready',
            error: message
          }));
          reject(new Error(message));
        }
      });
    });
  }, [clientId]);

  const signOut = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
    setState({
      status: clientId ? 'ready' : 'initializing',
      user: null,
      error: null
    });
  }, [clientId]);

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
    throw new Error('useAuth は AuthProvider の内側でのみ使用できます');
  }
  return value;
};
