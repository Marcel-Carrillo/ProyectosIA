import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { categoryService } from '../../services/categoryService';
import { Category } from '../../types/category';

interface CategoryNavProps {
  variant: 'header' | 'mobile';
  onNavClick?: () => void;
}

const CategoryNav: React.FC<CategoryNavProps> = ({ variant, onNavClick }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchParams] = useSearchParams();
  const activeCategoryId = searchParams.get('categoryId');
  const { t } = useTranslation('common');

  useEffect(() => {
    categoryService.getAll()
      .then(setCategories)
      .catch(() => {});
  }, []);

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
        {categories.map((cat) => (
          <li key={cat.id}>
            <Link
              to={`/catalog?categoryId=${cat.id}`}
              className={`storefront-nav__link${activeCategoryId === String(cat.id) ? ' storefront-nav__link--active' : ''}`}
              onClick={onNavClick}
            >
              {cat.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default CategoryNav;
