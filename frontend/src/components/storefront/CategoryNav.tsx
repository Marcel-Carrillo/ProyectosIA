import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStorefrontCategories } from '../../hooks/useStorefrontCategories';

interface CategoryNavProps {
  variant: 'header' | 'mobile';
  onNavClick?: () => void;
}

const CategoryNav: React.FC<CategoryNavProps> = ({ variant, onNavClick }) => {
  const [searchParams] = useSearchParams();
  const activeCategoryId = searchParams.get('categoryId');
  const { t } = useTranslation('common');
  const { links } = useStorefrontCategories();

  const navClass =
    variant === 'header'
      ? 'storefront-nav storefront-nav--header'
      : 'storefront-nav storefront-nav--mobile';

  return (
    <nav className={navClass} aria-label={t('nav.categoryNavLabel')}>
      <ul className="storefront-nav__list">
        <li>
          <Link
            to="/catalog"
            className={`storefront-nav__link${!activeCategoryId ? ' storefront-nav__link--active' : ''}`}
            onClick={onNavClick}
          >
            {t('nav.all')}
          </Link>
        </li>
        {links.map((cat) => (
          <li key={cat.id}>
            <Link
              to={cat.href}
              className={`storefront-nav__link${activeCategoryId === String(cat.id) ? ' storefront-nav__link--active' : ''}`}
              onClick={onNavClick}
            >
              {cat.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default CategoryNav;
