export interface Category {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  status: 'Active' | 'Inactive';
  parentId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryListResponse {
  success: boolean;
  data: Category[];
  message: string;
}
