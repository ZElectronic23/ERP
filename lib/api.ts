/**
 * مكتبة API مركزية - تجميع كل طلبات API في مكان واحد
 * الفوائد:
 * - سهولة الصيانة
 * - معالجة موحدة للأخطاء
 * - إعادة استخدام الكود
 * - Type safety كامل
 */

import { supabase } from './supabaseClient';

// ==================== TYPES ====================
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface UserData {
  email: string;
  password?: string;
  full_name?: string;
  phone?: string;
  role_key?: string;
  is_admin?: boolean;
  entity_type?: string;
  profile_image?: string;
  status?: string;
}

export interface ProductData {
  product_id?: string;
  name: string;
  category?: string;
  sell_price?: number;
  cost_price?: number;
  stock_quantity?: number;
  unit?: string;
  image?: string;
}

// ==================== BASE API CLASS ====================
class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api';
  }

  /**
   * معالجة موحدة للطلبات
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const text = await response.text();
      if (!text) {
        return {
          success: false,
          error: 'استجابة فارغة من الخادم',
        };
      }

      const data = JSON.parse(text);

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'حدث خطأ',
        };
      }

      return {
        success: true,
        data: data,
        message: data.message,
      };
    } catch (error: any) {
      console.error(`API Error [${endpoint}]:`, error);
      return {
        success: false,
        error: error.message || 'فشل الاتصال بالخادم',
      };
    }
  }

  // ==================== USER APIS ====================
  
  /**
   * جلب جميع المستخدمين
   */
  async getUsers(): Promise<ApiResponse<{ users: any[] }>> {
    return this.request('/admin/users/api');
  }

  /**
   * إنشاء مستخدم جديد
   */
  async createUser(userData: UserData): Promise<ApiResponse> {
    return this.request('/admin/users/api', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  /**
   * تحديث مستخدم
   */
  async updateUser(email: string, userData: Partial<UserData>): Promise<ApiResponse> {
    return this.request('/admin/users/api', {
      method: 'PATCH',
      body: JSON.stringify({ email, ...userData }),
    });
  }

  /**
   * حذف مؤقت (Soft Delete)
   */
  async softDeleteUser(email: string): Promise<ApiResponse> {
    return this.request('/admin/users/api/delete', {
      method: 'POST',
      body: JSON.stringify({ email, soft: true }),
    });
  }

  /**
   * حذف نهائي (Hard Delete)
   */
  async hardDeleteUser(email: string): Promise<ApiResponse> {
    return this.request('/admin/users/api/delete', {
      method: 'POST',
      body: JSON.stringify({ email, soft: false }),
    });
  }

  /**
   * استعادة مستخدم محذوف
   */
  async restoreUser(email: string): Promise<ApiResponse> {
    return this.request('/admin/users/api/restore', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  /**
   * تغيير حالة المستخدم
   */
  async changeUserStatus(email: string, status: string): Promise<ApiResponse> {
    return this.request('/admin/users/api/status', {
      method: 'POST',
      body: JSON.stringify({ email, status }),
    });
  }

  // ==================== PRODUCT APIS ====================

  /**
   * جلب جميع المنتجات
   */
  async getProducts(filters?: any): Promise<ApiResponse<any[]>> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .is('deleted_at', null)
      .order('product_id', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  }

  /**
   * إنشاء منتج جديد
   */
  async createProduct(productData: ProductData): Promise<ApiResponse> {
    const { data, error } = await supabase
      .from('products')
      .insert([productData])
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data, message: 'تم إضافة المنتج بنجاح' };
  }

  /**
   * تحديث منتج
   */
  async updateProduct(productId: string, productData: Partial<ProductData>): Promise<ApiResponse> {
    const { data, error } = await supabase
      .from('products')
      .update(productData)
      .eq('product_id', productId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data, message: 'تم تحديث المنتج بنجاح' };
  }

  /**
   * حذف منتج (Soft Delete)
   */
  async deleteProduct(productId: string): Promise<ApiResponse> {
    const { error } = await supabase
      .from('products')
      .update({ deleted_at: new Date().toISOString() })
      .eq('product_id', productId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, message: 'تم حذف المنتج' };
  }
}

// ==================== EXPORT SINGLETON ====================
export const api = new ApiClient();

// ==================== HELPER FUNCTIONS ====================

/**
 * معالجة استجابة API وعرض رسالة للمستخدم
 */
export function handleApiResponse<T>(
  response: ApiResponse<T>,
  onSuccess?: (data: T) => void,
  onError?: (error: string) => void
): boolean {
  if (response.success && response.data) {
    if (onSuccess) onSuccess(response.data);
    return true;
  } else {
    if (onError) onError(response.error || 'حدث خطأ');
    return false;
  }
}
