import axios from 'axios';
import i18n from '../i18n';
import {
  ProductListResponse,
  ProductResponse,
  ProductQueryParams,
} from '../types/product';
import { getUiLocale } from '../utils/uiLocale';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

const publicProductAxios = axios.create({ baseURL: API_BASE_URL });

publicProductAxios.interceptors.request.use((config) => {
  config.headers['Accept-Language'] = getUiLocale(i18n.language);
  return config;
});

export const productService = {
  getAll: async (params?: ProductQueryParams): Promise<ProductListResponse> => {
    try {
      const response = await publicProductAxios.get<ProductListResponse>(
        '/api/public/products',
        { params }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  },

  getById: async (id: number): Promise<ProductResponse> => {
    try {
      const response = await publicProductAxios.get<ProductResponse>(
        `/api/public/products/${id}`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching product:', error);
      throw error;
    }
  },

  create: (_data: unknown): never => { throw new Error('Not implemented'); },
  update: (_id: string, _data: unknown): never => { throw new Error('Not implemented'); },
  delete: (_id: string): never => { throw new Error('Not implemented'); },
};
