import axios from 'axios';
import i18n from '../i18n';
import { getUiLocale } from '../utils/uiLocale';

/**
 * Sends the active UI locale on every API request so backend content
 * negotiation (e.g. ProductTranslation resolution) matches what the visitor
 * sees. Installed once from the app entry point; productService keeps its own
 * axios instance with the same header for its dedicated public client.
 */
export function installAcceptLanguageInterceptor(): void {
  axios.interceptors.request.use((config) => {
    config.headers['Accept-Language'] = getUiLocale(i18n.resolvedLanguage || i18n.language);
    return config;
  });
}
