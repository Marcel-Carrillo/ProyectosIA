import axios from 'axios';
import i18n from '../i18n';
import {
  ProductListResponse,
  ProductResponse,
  ProductQueryParams,
} from '../types/product';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';

const publicProductAxios = axios.create({ baseURL: API_BASE_URL });

publicProductAxios.interceptors.request.use((config) => {
  const locale = i18n.language || 'es';
  config.headers['Accept-Language'] = locale;
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
