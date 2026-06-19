import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { login as authLogin, logout as authLogout, getCurrentUser, User, LoginCredentials } from '../services/auth';
import { storage } from '../utils/storage';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const checkCurrentUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        }
      } catch (error) {
        console.error('Error checking current user:', error);
        await storage.remove('driver_session');
      } finally {
        setIsLoading(false);
      }
    };

    checkCurrentUser();

    // Set up periodic session refresh every 30 minutes
    const sessionRefreshInterval = setInterval(async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        }
      } catch (error) {
        console.error('Error refreshing session:', error);
      }
    }, 30 * 60 * 1000); // 30 minutes

    // Listen for app resume/foreground events to refresh session
    const handleAppResume = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        }
      } catch (error) {
        console.error('Error refreshing session on app resume:', error);
      }
    };

    // Listen for visibility change (web)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleAppResume();
      }
    });

    // Listen for app state change (Capacitor)
    window.addEventListener('app-foreground-refresh', handleAppResume);

    return () => {
      clearInterval(sessionRefreshInterval);
      document.removeEventListener('visibilitychange', handleAppResume);
      window.removeEventListener('app-foreground-refresh', handleAppResume);
    };
  }, []);

  const login = async (credentials: LoginCredentials): Promise<User> => {
    setIsLoading(true);
    try {
      const user = await authLogin(credentials);
      setUser(user);
      return user;
    } catch (error) {
      setIsLoading(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authLogout();
      setUser(null);
    } catch (error) {
      console.error('Error during logout:', error);
      setUser(null);
      await storage.remove('driver_session');
    }
  };

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}