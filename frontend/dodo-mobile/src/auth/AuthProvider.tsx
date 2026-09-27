import { createContext, useContext, type PropsWithChildren } from 'react';

import { SKIP_LOGIN } from './config';
import { useAuthFlow } from './useAuth';

type AuthState = ReturnType<typeof useAuthFlow>;

const AuthContext = createContext<AuthState | null>(null);

const guestAuth: AuthState = {
  token: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: false,
  user: null,
  login: async () => {},
  signUp: async () => {},
  logout: async () => {},
  getValidAccessToken: async () => null,
};

function AuthenticatedProvider({ children }: PropsWithChildren) {
  const auth = useAuthFlow();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: PropsWithChildren) {
  if (SKIP_LOGIN) {
    return <AuthContext.Provider value={guestAuth}>{children}</AuthContext.Provider>;
  }
  return <AuthenticatedProvider>{children}</AuthenticatedProvider>;
}

export function useAuth(): AuthState {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used within AuthProvider');
  return auth;
}