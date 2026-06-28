import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  ANALYTICS_CONSENT_EVENT,
  CONSENT_EXPIRY_DAYS,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  ConsentCategories,
  ConsentRecord,
  CookieConsentContextValue,
} from '../constants/cookieConsent';

const CookieConsentContext = createContext<CookieConsentContextValue | undefined>(undefined);

export function isConsentValid(record: ConsentRecord | null): boolean {
  if (!record) return false;
  if (record.version !== CONSENT_VERSION) return false;
  const age = (Date.now() - new Date(record.timestamp).getTime()) / (1000 * 60 * 60 * 24);
  return age < CONSENT_EXPIRY_DAYS;
}

function readFromStorage(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ConsentRecord) : null;
  } catch {
    return null;
  }
}

function writeToStorage(record: ConsentRecord): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Silently fail (private browsing / storage quota)
  }
}

const DEFAULT_CONSENT: ConsentCategories = { necessary: true, analytics: false, marketing: false };

export const CookieConsentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [storedRecord, setStoredRecord] = useState<ConsentRecord | null>(() => readFromStorage());
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const previousFocusRef = useRef<Element | null>(null);

  const hasDecision = isConsentValid(storedRecord);
  const consent: ConsentCategories = hasDecision ? storedRecord!.categories : DEFAULT_CONSENT;

  const saveConsent = useCallback((categories: Pick<ConsentCategories, 'analytics' | 'marketing'>) => {
    const record: ConsentRecord = {
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      categories: { necessary: true, ...categories },
    };
    writeToStorage(record);
    setStoredRecord(record);
    setIsPreferencesOpen(false);
    if (categories.analytics) {
      window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_EVENT));
    }
  }, []);

  const openPreferences = useCallback(() => {
    previousFocusRef.current = document.activeElement;
    setIsPreferencesOpen(true);
  }, []);

  const closePreferences = useCallback(() => {
    setIsPreferencesOpen(false);
    setTimeout(() => {
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    }, 0);
  }, []);

  return (
    <CookieConsentContext.Provider
      value={{ consent, hasDecision, isPreferencesOpen, saveConsent, openPreferences, closePreferences }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
};

export function useCookieConsent(): CookieConsentContextValue {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error('useCookieConsent must be used inside CookieConsentProvider');
  return ctx;
}
