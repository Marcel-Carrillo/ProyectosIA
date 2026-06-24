import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AccountLayout from '../../components/storefront/AccountLayout';
import { getProfile, updateProfile } from '../../services/customerAuthService';
import { CustomerProfile } from '../../types/auth';

const AccountProfilePage: React.FC = () => {
  const { t } = useTranslation('account');
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getProfile().then((p) => {
      setProfile(p);
      setFirstName(p.firstName);
      setLastName(p.lastName);
      setPhone(p.phone ?? '');
    }).catch(() => setError(t('profile.errors.load')));
  }, [t]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const updated = await updateProfile({ firstName, lastName, phone });
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError(t('profile.errors.save'));
    }
  };

  return (
    <AccountLayout title={t('profile.title')}>
      <div className="storefront-account__panel">
        <h2 className="storefront-account__panel-title">{t('profile.panelTitle')}</h2>
        {error && <p className="storefront-account__alert storefront-account__alert--error" role="alert">{error}</p>}
        {saved && (
          <p className="storefront-account__alert storefront-account__alert--success" role="status">
            {t('profile.success')}
          </p>
        )}
        {profile ? (
          <form className="storefront-account__form" onSubmit={handleSave}>
            <label className="storefront-field">
              <span className="storefront-field__label">{t('profile.fields.email')}</span>
              <input
                className="storefront-field__input"
                value={profile.email}
                disabled
                readOnly
              />
            </label>
            <label className="storefront-field">
              <span className="storefront-field__label">{t('profile.fields.firstName')}</span>
              <input
                className="storefront-field__input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </label>
            <label className="storefront-field">
              <span className="storefront-field__label">{t('profile.fields.lastName')}</span>
              <input
                className="storefront-field__input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </label>
            <label className="storefront-field">
              <span className="storefront-field__label">{t('profile.fields.phone')}</span>
              <input
                className="storefront-field__input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <div className="storefront-account__form-actions">
              <button type="submit" className="storefront-btn storefront-btn--primary storefront-btn--press">
                {t('profile.save')}
              </button>
            </div>
          </form>
        ) : !error && (
          <p className="storefront-account__loading">{t('common.loading')}</p>
        )}
      </div>
    </AccountLayout>
  );
};

export default AccountProfilePage;
