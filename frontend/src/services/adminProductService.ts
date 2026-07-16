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
  UpsertTranslationInput,
  TranslationResponse,
  TranslationListResponse,
  SupportedLocale,
} from '../types/product';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const ADMIN_BASE = `${API_BASE_URL}/api/admin/products`;

// ─── Error-code → UI-message mapping ─────────────────────────────────────────

export function mapProductError(code: string): string {
  switch (code) {
    case 'PRODUCT_REQUIRES_ACTIVE_VARIANT':
      return 'El producto requiere al menos una variante activa antes de poder activarse.';
    case 'PRODUCT_ARCHIVED_CANNOT_REACTIVATE':
      return 'Los productos archivados no pueden cambiar de estado.';
    case 'PRODUCT_SLUG_CONFLICT':
      return 'Ya existe un producto con este nombre. Intente modificar el nombre del producto.';
    case 'PRODUCT_NOT_FOUND':
      return 'Producto no encontrado.';
    case 'VARIANT_NOT_FOUND':
      return 'Variante no encontrada.';
    case 'VARIANT_SKU_CONFLICT':
      return 'Ya existe una variante con este SKU.';
    case 'VARIANT_COMPARE_PRICE_INVALID':
      return 'El precio de comparación debe ser mayor que el precio público.';
    case 'IMAGE_NOT_FOUND':
      return 'Imagen no encontrada.';
    case 'CJ_ITEM_NOT_MAPPED':
      return 'Esta variante no está vinculada a un artículo del catálogo del proveedor; no se puede estimar el envío.';
    case 'CJ_API_UNAVAILABLE':
      return 'El servicio de CJ Dropshipping no está disponible en este momento. Inténtelo de nuevo más tarde.';
    default:
      return 'Ha ocurrido un error inesperado. Inténtelo de nuevo.';
  }
}

/** Extracts the backend error code from an unknown error and maps it to a message. */
export function extractErrorMessage(error: unknown): string {
  const code = (error as AxiosError<AdminApiError>).response?.data?.error?.code;
  return mapProductError(code ?? '');
}

export function extractErrorCode(error: unknown): string {
  return (error as AxiosError<AdminApiError>).response?.data?.error?.code ?? '';
}

// ─── Admin product CRUD (+ nested variants and images) ───────────────────────
// Security invariant: supplier fields (supplierId/supplierReference/
// supplierCost/supplierName) are READ-ONLY here — the admin API returns them
// for margin visibility, but the write payload types (CreateVariantInput/
// UpdateVariantInput) exclude them at compile time so they are never sent.

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

  refreshFreightEstimate: async (
    productId: number,
    variantId: number,
    destinationCountry?: string,
  ): Promise<VariantResponse> => {
    try {
      const response = await axios.post<VariantResponse>(
        `${ADMIN_BASE}/${productId}/variants/${variantId}/freight-estimate`,
        destinationCountry ? { destinationCountry } : {},
      );
      return response.data;
    } catch (error) {
      console.error('Error refreshing freight estimate:', error);
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

  // ─── Translations ──────────────────────────────────────────────────────────

  listTranslations: async (productId: number): Promise<TranslationListResponse> => {
    try {
      const response = await axios.get<TranslationListResponse>(`${ADMIN_BASE}/${productId}/translations`);
      return response.data;
    } catch (error) {
      console.error('Error fetching translations:', error);
      throw error;
    }
  },

  upsertTranslation: async (
    productId: number,
    locale: SupportedLocale,
    data: UpsertTranslationInput,
  ): Promise<TranslationResponse> => {
    try {
      const response = await axios.put<TranslationResponse>(
        `${ADMIN_BASE}/${productId}/translations/${locale}`,
        data,
      );
      return response.data;
    } catch (error) {
      console.error('Error upserting translation:', error);
      throw error;
    }
  },

  deleteTranslation: async (productId: number, locale: SupportedLocale): Promise<void> => {
    try {
      await axios.delete(`${ADMIN_BASE}/${productId}/translations/${locale}`);
    } catch (error) {
      console.error('Error deleting translation:', error);
      throw error;
    }
  },
};
