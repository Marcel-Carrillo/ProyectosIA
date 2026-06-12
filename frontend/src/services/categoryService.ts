import axios from 'axios';
import { Category, CategoryListResponse } from '../types/category';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';

export const categoryService = {
  getAll: async (): Promise<Category[]> => {
    try {
      const response = await axios.get<CategoryListResponse>(
        `${API_BASE_URL}/categories`
      );
      return response.data.data;
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  },

  getById: (_id: string): never => { throw new Error('Not implemented'); },
  create: (_data: unknown): never => { throw new Error('Not implemented'); },
  update: (_id: string, _data: unknown): never => { throw new Error('Not implemented'); },
  delete: (_id: string): never => { throw new Error('Not implemented'); },
};
