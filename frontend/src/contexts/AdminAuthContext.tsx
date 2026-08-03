import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  adminLogin as apiLogin,
  adminLogout as apiLogout,
  adminMe,
  adminRefresh,
  adminVerify2fa as apiVerify2fa,
  getAdminAccessToken,
  setAdminAccessToken,
} from '../services/adminAuthService';
import { AdminUser } from '../types/auth';

interface AdminAuthContextValue {
  admin: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ mfaRequired: true; mfaToken: string } | void>;
  verify2fa: (mfaToken: string, code: string) => Promise<void>;
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
    if ('mfaRequired' in data && data.mfaRequired) {
      return { mfaRequired: true as const, mfaToken: data.mfaToken };
    }
    if ('admin' in data) {
      setAdmin(data.admin);
    }
  }, []);

  const verify2fa = useCallback(async (mfaToken: string, code: string) => {
    const data = await apiVerify2fa(mfaToken, code);
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
      verify2fa,
      logout,
    }),
    [admin, isLoading, login, verify2fa, logout]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
};

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
