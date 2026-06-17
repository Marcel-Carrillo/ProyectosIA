export interface EscuelaJsCategory {
  id: number;
  name: string;
  slug: string;
  image: string;
  creationAt: string;
  updatedAt: string;
}

export interface EscuelaJsProduct {
  id: number;
  title: string;
  slug: string;
  price: number;
  description: string;
  category: EscuelaJsCategory;
  images: string[];
  creationAt: string;
  updatedAt: string;
}

export const ESCUELAJS_PRODUCTS_URL = 'https://api.escuelajs.co/api/v1/products';
