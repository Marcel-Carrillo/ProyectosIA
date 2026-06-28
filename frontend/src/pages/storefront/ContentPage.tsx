import React, { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

const VALID_SLUGS = [
  'shipping',
  'returns',
  'size-guide',
  'contact',
  'our-story',
  'materials',
  'sustainability',
  'press',
  'privacy',
  'legal',
] as const;

type ContentSlug = (typeof VALID_SLUGS)[number];

interface ContentSection {
  heading: string;
  body: string;
}

const API_BASE = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';

function ContactForm() {
  const { t } = useTranslation('pages');
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus('idle');
    try {
      await axios.post(`${API_BASE}/api/public/contact`, form);
      setStatus('success');
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch {
      setStatus('error');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'success') {
    return (
      <div className="storefront-contact-form__feedback">
        <p className="storefront-contact-form__feedback-title">{t('contact.form.successTitle')}</p>
        <p className="storefront-contact-form__feedback-body">{t('contact.form.successBody')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="storefront-contact-form">
      {status === 'error' && (
        <p className="storefront-auth__error" role="alert">{t('contact.form.errorMessage')}</p>
      )}
      <div className="storefront-contact-form__grid">
        <label className="storefront-field">
          <span className="storefront-field__label">{t('contact.form.name')}</span>
          <input
            type="text"
            name="name"
            className="storefront-field__input"
            value={form.name}
            onChange={handleChange}
            placeholder={t('contact.form.namePlaceholder')}
            required
            autoComplete="name"
          />
        </label>
        <label className="storefront-field">
          <span className="storefront-field__label">{t('contact.form.email')}</span>
          <input
            type="email"
            name="email"
            className="storefront-field__input"
            value={form.email}
            onChange={handleChange}
            placeholder={t('contact.form.emailPlaceholder')}
            required
            autoComplete="email"
          />
        </label>
        <label className="storefront-field storefront-field--wide">
          <span className="storefront-field__label">{t('contact.form.subject')}</span>
          <input
            type="text"
            name="subject"
            className="storefront-field__input"
            value={form.subject}
            onChange={handleChange}
            placeholder={t('contact.form.subjectPlaceholder')}
            required
          />
        </label>
        <label className="storefront-field storefront-field--wide">
          <span className="storefront-field__label">{t('contact.form.message')}</span>
          <textarea
            name="message"
            className="storefront-field__input storefront-field__textarea"
            value={form.message}
            onChange={handleChange}
            placeholder={t('contact.form.messagePlaceholder')}
            required
            rows={5}
          />
        </label>
      </div>
      <button type="submit" className="storefront-btn storefront-btn--primary" disabled={submitting}>
        {submitting ? t('contact.form.sending') : t('contact.form.send')}
      </button>
    </form>
  );
}

const ContentPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation('pages');

  if (!slug || !VALID_SLUGS.includes(slug as ContentSlug)) {
    return <Navigate to="/catalog" replace />;
  }

  const sections = t(`${slug}.sections`, { returnObjects: true }) as ContentSection[] | string;
  const sectionList = Array.isArray(sections) ? sections : [];
  const isContact = slug === 'contact';

  return (
    <article className="storefront-content-page storefront-animate-fade-up">
      <div className="storefront-container storefront-content-page__inner">
        <Link to="/catalog" className="storefront-content-page__back">
          {t('backToShop')}
        </Link>
        <p className="storefront-content-page__eyebrow">{t(`${slug}.eyebrow`)}</p>
        <h1 className="storefront-content-page__title">{t(`${slug}.title`)}</h1>
        <p className="storefront-content-page__intro">{t(`${slug}.intro`)}</p>
        <div className="storefront-content-page__sections">
          {sectionList.map((section) => (
            <section key={section.heading} className="storefront-content-page__section">
              <h2 className="storefront-content-page__section-title">{section.heading}</h2>
              <p className="storefront-content-page__section-body">{section.body}</p>
            </section>
          ))}
        </div>
        {isContact && (
          <div className="storefront-content-page__contact-form">
            <div className="storefront-content-page__divider" />
            <h2 className="storefront-content-page__section-title">
              {t('contact.form.heading')}
            </h2>
            <p className="storefront-content-page__section-body">
              {t('contact.form.intro')}
            </p>
            <ContactForm />
          </div>
        )}
      </div>
    </article>
  );
};

export default ContentPage;
