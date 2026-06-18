import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  adminLogin as apiLogin,
  adminLogout as apiLogout,
  adminMe,
  adminRefresh,
  getAdminAccessToken,
  setAdminAccessToken,
} from '../services/adminAuthService';
import { AdminUser } from '../types/auth';

interface AdminAuthContextValue {
  admin: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = getAdminAccessToken();
        if (!token) {
          const refreshed = await adminRefresh();
          if (!refreshed) {
            if (!cancelled) setIsLoading(false);
            return;
          }
        }
        const profile = await adminMe();
        if (!cancelled) setAdmin(profile);
      } catch {
        setAdminAccessToken(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin(email, password);
    setAdmin(data.admin);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setAdmin(null);
  }, []);

  const value = useMemo(
    () => ({
      admin,
      isLoading,
      isAuthenticated: !!admin,
      login,
      logout,
    }),
    [admin, isLoading, login, logout]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
};

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
