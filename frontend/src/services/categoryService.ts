import axios from 'axios';
import { Category, CategoryListResponse } from '../types/category';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export const categoryService = {
  // Storefront / public catalog — Active categories only.
  getAll: async (): Promise<Category[]> => {
    try {
      const response = await axios.get<CategoryListResponse>(
        `${API_BASE_URL}/api/public/categories`
      );
      return response.data.data;
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  },

  // Admin list — includes Inactive (CJ auto-created categories start Inactive
  // so they don't appear in storefront nav until reviewed; admins still need
  // them for product filters, labels, and the promote override dropdown).
  getAllAdmin: async (includeInactive = true): Promise<Category[]> => {
    try {
      const response = await axios.get<CategoryListResponse>(
        `${API_BASE_URL}/api/admin/categories`,
        { params: includeInactive ? { includeInactive: 'true' } : undefined }
      );
      return response.data.data;
    } catch (error) {
      console.error('Error fetching admin categories:', error);
      throw error;
    }
  },

  getById: (_id: string): never => { throw new Error('Not implemented'); },
  create: (_data: unknown): never => { throw new Error('Not implemented'); },
  update: (_id: string, _data: unknown): never => { throw new Error('Not implemented'); },
  delete: (_id: string): never => { throw new Error('Not implemented'); },
};
