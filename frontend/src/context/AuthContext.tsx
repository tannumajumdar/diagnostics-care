import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authApi } from '../api/auth.api';

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loading: boolean;
  /** Resolves with the signed-in user so the caller can route by role. */
  login: (credentials: any, password?: string) => Promise<User>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      const savedUserStr = localStorage.getItem('user');

      if (token) {
        if (savedUserStr) {
          try {
            setUser(JSON.parse(savedUserStr));
          } catch {
            // fallback
          }
        }
        try {
          const userData = await authApi.getProfile();
          const profile = userData?.data || userData;
          if (profile) {
            setUser(profile);
            localStorage.setItem('user', JSON.stringify(profile));
          }
        } catch {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (emailOrPayload: any, password?: string) => {
    const payload = typeof emailOrPayload === 'string' ? { email: emailOrPayload, password } : emailOrPayload;
    const response: any = await authApi.login(payload);

    const authData = response.data || response;
    const accessToken = authData.accessToken || response.accessToken;
    const userObj = authData.user || response.user;

    if (!accessToken) {
      throw new Error(response.message || 'Login failed - invalid token payload');
    }

    localStorage.setItem('token', accessToken);
    localStorage.setItem('user', JSON.stringify(userObj));
    setUser(userObj);
    return userObj as User;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, loading: isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
