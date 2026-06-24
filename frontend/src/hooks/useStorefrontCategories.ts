import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { categoryService } from '../services/categoryService';
import {
  STOREFRONT_CATEGORY_ORDER,
  StorefrontCategoryKey,
  categoryNameToKey,
} from '../constants/storefrontCategories';

export interface StorefrontCategoryLink {
  id: number;
  key: StorefrontCategoryKey;
  label: string;
  href: string;
}

export function useStorefrontCategories() {
  const { t } = useTranslation('common');
  const [categoryIds, setCategoryIds] = useState<Partial<Record<StorefrontCategoryKey, number>>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    categoryService
      .getAll()
      .then((categories) => {
        if (cancelled) return;
        const ids: Partial<Record<StorefrontCategoryKey, number>> = {};
        categories
          .filter((cat) => cat.status === 'Active')
          .forEach((cat) => {
            const key = categoryNameToKey(cat.name);
            if (key) ids[key] = cat.id;
          });
        setCategoryIds(ids);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const links = useMemo<StorefrontCategoryLink[]>(() => {
    return STOREFRONT_CATEGORY_ORDER.flatMap((key) => {
      const id = categoryIds[key];
      if (!id) return [];
      return [{
        id,
        key,
        label: t(`nav.category.${key}`),
        href: `/catalog?categoryId=${id}`,
      }];
    });
  }, [categoryIds, t]);

  const getHref = (key: StorefrontCategoryKey) => {
    const id = categoryIds[key];
    return id ? `/catalog?categoryId=${id}` : '/catalog';
  };

  return { links, categoryIds, getHref, isLoading };
}
