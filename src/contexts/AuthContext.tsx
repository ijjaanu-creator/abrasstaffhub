import React, { createContext, useContext, useState, useCallback } from 'react';
import { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo users for testing
const demoUsers: Record<string, { password: string; user: User }> = {
  'admin@abras.com': {
    password: 'admin123',
    user: {
      id: '1',
      email: 'admin@abras.com',
      name: 'Ahmed Hassan',
      role: 'admin',
      avatar: undefined,
    },
  },
  'staff@abras.com': {
    password: 'staff123',
    user: {
      id: '2',
      email: 'staff@abras.com',
      name: 'Fatima Ali',
      role: 'staff',
      avatar: undefined,
    },
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    const demoUser = demoUsers[email.toLowerCase()];
    if (demoUser && demoUser.password === password) {
      setUser(demoUser.user);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    isAdmin: user?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
