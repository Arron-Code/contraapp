import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import type { User } from './types';

interface AuthContextValue {
  user: User | null;
  login: (tenant: string, email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

interface RegisterData {
  company: string;
  tenant: string;
  name: string;
  email: string;
  password: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('ericargo_user');
    return stored ? JSON.parse(stored) as User : null;
  });

  const persist = (result: { token: string; user: User }) => {
    localStorage.setItem('ericargo_token', result.token);
    localStorage.setItem('ericargo_user', JSON.stringify(result.user));
    setUser(result.user);
  };

  const value = useMemo<AuthContextValue>(() => ({
    user,
    login: async (tenant, email, password) => {
      persist(await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ tenant, email, password }),
      }));
    },
    register: async (data) => {
      persist(await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }));
    },
    logout: () => {
      localStorage.removeItem('ericargo_token');
      localStorage.removeItem('ericargo_user');
      setUser(null);
    },
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
