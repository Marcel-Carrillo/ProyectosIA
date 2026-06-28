import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { CookieConsentProvider, useCookieConsent, isConsentValid } from '../CookieConsentContext';
import { CONSENT_VERSION, CONSENT_STORAGE_KEY, ConsentRecord } from '../../constants/cookieConsent';

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <CookieConsentProvider>{children}</CookieConsentProvider>
);

describe('isConsentValid', () => {
  it('returns false for null', () => {
    expect(isConsentValid(null)).toBe(false);
  });

  it('returns false when version mismatches', () => {
    const record: ConsentRecord = {
      version: '0',
      timestamp: new Date().toISOString(),
      categories: { necessary: true, analytics: true, marketing: false },
    };
    expect(isConsentValid(record)).toBe(false);
  });

  it('returns false when timestamp is older than 365 days', () => {
    const old = new Date();
    old.setFullYear(old.getFullYear() - 2);
    const record: ConsentRecord = {
      version: CONSENT_VERSION,
      timestamp: old.toISOString(),
      categories: { necessary: true, analytics: false, marketing: false },
    };
    expect(isConsentValid(record)).toBe(false);
  });

  it('returns true for a fresh record with correct version', () => {
    const record: ConsentRecord = {
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      categories: { necessary: true, analytics: true, marketing: true },
    };
    expect(isConsentValid(record)).toBe(true);
  });
});

describe('saveConsent', () => {
  beforeEach(() => localStorage.clear());

  it('writes correct shape to localStorage', () => {
    const { result } = renderHook(() => useCookieConsent(), { wrapper });
    act(() => { result.current.saveConsent({ analytics: true, marketing: false }); });
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY)!;
    const record = JSON.parse(raw) as ConsentRecord;
    expect(record.version).toBe(CONSENT_VERSION);
    expect(record.categories).toEqual({ necessary: true, analytics: true, marketing: false });
    expect(record.timestamp).toBeTruthy();
  });

  it('forces necessary to true', () => {
    const { result } = renderHook(() => useCookieConsent(), { wrapper });
    act(() => { result.current.saveConsent({ analytics: false, marketing: false }); });
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY)!;
    const record = JSON.parse(raw) as ConsentRecord;
    expect(record.categories.necessary).toBe(true);
  });
});

describe('useCookieConsent', () => {
  beforeEach(() => localStorage.clear());

  it('returns hasDecision false when localStorage is empty', () => {
    const { result } = renderHook(() => useCookieConsent(), { wrapper });
    expect(result.current.hasDecision).toBe(false);
  });

  it('returns hasDecision true when valid record exists', () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      categories: { necessary: true, analytics: false, marketing: false },
    }));
    const { result } = renderHook(() => useCookieConsent(), { wrapper });
    expect(result.current.hasDecision).toBe(true);
  });

  it('consent updates synchronously after saveConsent', () => {
    const { result } = renderHook(() => useCookieConsent(), { wrapper });
    act(() => { result.current.saveConsent({ analytics: true, marketing: true }); });
    expect(result.current.consent.analytics).toBe(true);
    expect(result.current.consent.marketing).toBe(true);
  });

  it('isPreferencesOpen toggles on openPreferences / closePreferences', () => {
    const { result } = renderHook(() => useCookieConsent(), { wrapper });
    expect(result.current.isPreferencesOpen).toBe(false);
    act(() => { result.current.openPreferences(); });
    expect(result.current.isPreferencesOpen).toBe(true);
    act(() => { result.current.closePreferences(); });
    expect(result.current.isPreferencesOpen).toBe(false);
  });
});
