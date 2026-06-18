import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  customerLogin,
  customerLogout,
  customerMe,
  customerRefresh,
  customerRegister,
  customerVerify2fa,
  getCustomerAccessToken,
  setCustomerAccessToken,
} from '../services/customerAuthService';
import { CustomerAccount, CustomerProfile } from '../types/auth';

interface CustomerAuthContextValue {
  account: CustomerAccount | null;
  customer: CustomerProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ mfaRequired?: boolean; mfaToken?: string }>;
  verify2fa: (mfaToken: string, code: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | undefined>(undefined);

export const CustomerAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback((data: { account: CustomerAccount; customer: CustomerProfile }) => {
    setAccount(data.account);
    setCustomer(data.customer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!getCustomerAccessToken()) {
          await customerRefresh();
        }
        const data = await customerMe();
        if (!cancelled) applySession(data);
      } catch {
        setCustomerAccessToken(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await customerLogin(email, password);
    if ('mfaRequired' in result && result.mfaRequired) {
      return { mfaRequired: true, mfaToken: result.mfaToken };
    }
    applySession(result as { account: CustomerAccount; customer: CustomerProfile });
    return {};
  }, [applySession]);

  const verify2fa = useCallback(async (mfaToken: string, code: string) => {
    const result = await customerVerify2fa(mfaToken, code);
    applySession(result);
  }, [applySession]);

  const register = useCallback(async (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) => {
    const result = await customerRegister(input);
    applySession(result);
  }, [applySession]);

  const logout = useCallback(async () => {
    await customerLogout();
    setAccount(null);
    setCustomer(null);
  }, []);

  const value = useMemo(
    () => ({
      account,
      customer,
      isLoading,
      isAuthenticated: !!account,
      login,
      verify2fa,
      register,
      logout,
    }),
    [account, customer, isLoading, login, verify2fa, register, logout]
  );

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
};

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  return ctx;
}
