import { createContext, useContext, useEffect, useState } from 'react';
import { loginWithBackendSession, logoutFromBackend, readCurrentUser } from '../../services/authService';
import type { AppUser, Role } from '../../types';

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  login: (input: {
    role: Role;
    fullName: string;
    email?: string;
    phone?: string;
    rememberMe?: boolean;
  }) => Promise<AppUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const current = await readCurrentUser();
      setUser(current);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function login(input: {
    role: Role;
    fullName: string;
    email?: string;
    phone?: string;
    rememberMe?: boolean;
  }) {
    setLoading(true);
    try {
      const loggedIn = await loginWithBackendSession(input);
      setUser(loggedIn);
      return loggedIn;
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await logoutFromBackend();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
