import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { categoryService } from '../../services/categoryService';
import { Category } from '../../types/category';

const CategoryNav: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchParams] = useSearchParams();
  const activeCategoryId = searchParams.get('categoryId');

  useEffect(() => {
    categoryService.getAll()
      .then(setCategories)
      .catch(() => {});
  }, []);

  return (
    <nav className="storefront-nav" aria-label="Category navigation">
      <ul className="storefront-nav__list">
        <li>
          <Link
            to="/catalog"
            className={`storefront-nav__link${!activeCategoryId ? ' storefront-nav__link--active' : ''}`}
          >
            All
          </Link>
        </li>
        {categories.map((cat) => (
          <li key={cat.id}>
            <Link
              to={`/catalog?categoryId=${cat.id}`}
              className={`storefront-nav__link${activeCategoryId === String(cat.id) ? ' storefront-nav__link--active' : ''}`}
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
