import React from 'react';
import './i18n/index';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';
import './styles/tokens.css';
import './styles/storefront.css';
import './styles/admin.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import {
  ANALYTICS_CONSENT_EVENT,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  CONSENT_EXPIRY_DAYS,
} from './constants/cookieConsent';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

function hasAnalyticsConsentOnBoot(): boolean {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return false;
    const record = JSON.parse(raw) as { version?: string; timestamp?: string; categories?: { analytics?: boolean } };
    if (record.version !== CONSENT_VERSION) return false;
    const ageMs = Date.now() - new Date(record.timestamp ?? '').getTime();
    if (ageMs > CONSENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000) return false;
    return record.categories?.analytics === true;
  } catch {
    return false;
  }
}

if (hasAnalyticsConsentOnBoot()) {
  reportWebVitals();
}

window.addEventListener(
  ANALYTICS_CONSENT_EVENT,
  () => { reportWebVitals(); },
  { once: true }
);
