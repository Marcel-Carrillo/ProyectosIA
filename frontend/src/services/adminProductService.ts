import axios, { AxiosError } from 'axios';
import {
  ProductQueryParams,
  ProductListResponse,
  ProductResponse,
  CreateProductInput,
  UpdateProductInput,
  VariantListResponse,
  VariantResponse,
  CreateVariantInput,
  UpdateVariantInput,
  ImageListResponse,
  ImageResponse,
  CreateImageInput,
  UpdateImageInput,
  AdminApiError,
} from '../types/product';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3000';
const ADMIN_BASE = `${API_BASE_URL}/api/admin/products`;

// ─── Error-code → UI-message mapping ─────────────────────────────────────────

export function mapProductError(code: string): string {
  switch (code) {
    case 'PRODUCT_REQUIRES_ACTIVE_VARIANT':
      return 'Product requires at least one active variant before it can be activated.';
    case 'PRODUCT_ARCHIVED_CANNOT_REACTIVATE':
      return 'Archived products cannot change status.';
    case 'PRODUCT_SLUG_CONFLICT':
      return 'A product with this name already exists. Try adjusting the product name.';
    case 'PRODUCT_NOT_FOUND':
      return 'Product not found.';
    case 'VARIANT_NOT_FOUND':
      return 'Variant not found.';
    case 'VARIANT_SKU_CONFLICT':
      return 'A variant with this SKU already exists.';
    case 'VARIANT_COMPARE_PRICE_INVALID':
      return 'Compare-at price must be greater than the public price.';
    case 'IMAGE_NOT_FOUND':
      return 'Image not found.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

/** Extracts the backend error code from an unknown error and maps it to a message. */
export function extractErrorMessage(error: unknown): string {
  const code = (error as AxiosError<AdminApiError>).response?.data?.error?.code;
  return mapProductError(code ?? '');
}

// ─── Admin product CRUD (+ nested variants and images) ───────────────────────
// Security invariant: this service never sends or references supplierId,
// supplierReference, or supplierCost; the write types enforce it at compile time.

export const adminProductService = {
  list: async (params?: ProductQueryParams): Promise<ProductListResponse> => {
    try {
      const response = await axios.get<ProductListResponse>(ADMIN_BASE, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching admin products:', error);
      throw error;
    }
  },

  getById: async (id: number): Promise<ProductResponse> => {
    try {
      const response = await axios.get<ProductResponse>(`${ADMIN_BASE}/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching admin product:', error);
      throw error;
    }
  },

  create: async (data: CreateProductInput): Promise<ProductResponse> => {
    try {
      const response = await axios.post<ProductResponse>(ADMIN_BASE, data);
      return response.data;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  },

  update: async (id: number, data: UpdateProductInput): Promise<ProductResponse> => {
    try {
      const response = await axios.patch<ProductResponse>(`${ADMIN_BASE}/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  },

  remove: async (id: number): Promise<void> => {
    try {
      await axios.delete(`${ADMIN_BASE}/${id}`);
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  },

  // ─── Variants ──────────────────────────────────────────────────────────────

  listVariants: async (productId: number): Promise<VariantListResponse> => {
    try {
      const response = await axios.get<VariantListResponse>(`${ADMIN_BASE}/${productId}/variants`);
      return response.data;
    } catch (error) {
      console.error('Error fetching variants:', error);
      throw error;
    }
  },

  createVariant: async (productId: number, data: CreateVariantInput): Promise<VariantResponse> => {
    try {
      const response = await axios.post<VariantResponse>(`${ADMIN_BASE}/${productId}/variants`, data);
      return response.data;
    } catch (error) {
      console.error('Error creating variant:', error);
      throw error;
    }
  },

  updateVariant: async (
    productId: number,
    variantId: number,
    data: UpdateVariantInput,
  ): Promise<VariantResponse> => {
    try {
      const response = await axios.patch<VariantResponse>(
        `${ADMIN_BASE}/${productId}/variants/${variantId}`,
        data,
      );
      return response.data;
    } catch (error) {
      console.error('Error updating variant:', error);
      throw error;
    }
  },

  deleteVariant: async (productId: number, variantId: number): Promise<void> => {
    try {
      await axios.delete(`${ADMIN_BASE}/${productId}/variants/${variantId}`);
    } catch (error) {
      console.error('Error deleting variant:', error);
      throw error;
    }
  },

  // ─── Images ────────────────────────────────────────────────────────────────

  listImages: async (productId: number): Promise<ImageListResponse> => {
    try {
      const response = await axios.get<ImageListResponse>(`${ADMIN_BASE}/${productId}/images`);
      return response.data;
    } catch (error) {
      console.error('Error fetching images:', error);
      throw error;
    }
  },

  addImage: async (productId: number, data: CreateImageInput): Promise<ImageResponse> => {
    try {
      const response = await axios.post<ImageResponse>(`${ADMIN_BASE}/${productId}/images`, data);
      return response.data;
    } catch (error) {
      console.error('Error adding image:', error);
      throw error;
    }
  },

  updateImage: async (
    productId: number,
    imageId: number,
    data: UpdateImageInput,
  ): Promise<ImageResponse> => {
    try {
      const response = await axios.patch<ImageResponse>(
        `${ADMIN_BASE}/${productId}/images/${imageId}`,
        data,
      );
      return response.data;
    } catch (error) {
      console.error('Error updating image:', error);
      throw error;
    }
  },

  deleteImage: async (productId: number, imageId: number): Promise<void> => {
    try {
      await axios.delete(`${ADMIN_BASE}/${productId}/images/${imageId}`);
    } catch (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
  },
};
