export const CONSENT_VERSION = '1';
export const CONSENT_STORAGE_KEY = 'mavile.cookieConsent';
export const CONSENT_EXPIRY_DAYS = 365;
export const ANALYTICS_CONSENT_EVENT = 'mavile:analyticsConsentGranted';

export interface ConsentCategories {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

export interface ConsentRecord {
  version: string;
  timestamp: string;
  categories: ConsentCategories;
}

export interface CookieConsentContextValue {
  consent: ConsentCategories;
  hasDecision: boolean;
  isPreferencesOpen: boolean;
  saveConsent: (categories: Pick<ConsentCategories, 'analytics' | 'marketing'>) => void;
  openPreferences: () => void;
  closePreferences: () => void;
}
