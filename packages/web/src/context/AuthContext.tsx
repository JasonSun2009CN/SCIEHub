import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '@sciehub/shared';
import { api, getToken, setToken } from '@/lib/api';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: { username: string; nickname: string; email: string; password: string }) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [loading, setLoading] = useState<boolean>(() => Boolean(getToken()));

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    api<{ user: User }>('/auth/me')
      .then(({ user }) => {
        if (!cancelled) setUser(user);
      })
      .catch(() => {
        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyAuth = useCallback(
    (newToken: string, newUser: User) => {
      setToken(newToken);
      setTokenState(newToken);
      setUser(newUser);
    },
    [],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        json: { email, password },
      });
      applyAuth(data.token, data.user);
      return data.user;
    },
    [applyAuth],
  );

  const register = useCallback(
    async (input: { username: string; nickname: string; email: string; password: string }) => {
      const data = await api<{ token: string; user: User }>('/auth/register', {
        method: 'POST',
        json: input,
      });
      applyAuth(data.token, data.user);
      return data.user;
    },
    [applyAuth],
  );

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const refresh = useCallback(async () => {
    const data = await api<{ user: User }>('/auth/me');
    setUser(data.user);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
