import axios from 'axios';
import {
  ProductListResponse,
  ProductResponse,
  ProductQueryParams,
} from '../types/product';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';

export const productService = {
  getAll: async (params?: ProductQueryParams): Promise<ProductListResponse> => {
    try {
      const response = await axios.get<ProductListResponse>(
        `${API_BASE_URL}/api/public/products`,
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
      const response = await axios.get<ProductResponse>(
        `${API_BASE_URL}/api/public/products/${id}`
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
