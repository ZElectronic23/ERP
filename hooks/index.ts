/**
 * Custom Hooks - إدارة موحدة للـ state
 * كل الـ hooks المتاحة في مكان واحد
 */

import { useState, useEffect, useCallback } from 'react';
import { api, ApiResponse } from '@/lib/api';

// ==================== useAsync Hook ====================
/**
 * Hook عام لإدارة العمليات غير المتزامنة
 */
export function useAsync<T>(
  asyncFunction: () => Promise<ApiResponse<T>>,
  immediate = true
) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await asyncFunction();
      if (response.success && response.data) {
        setData(response.data);
      } else {
        setError(response.error || 'حدث خطأ');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  }, [asyncFunction]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { loading, data, error, execute, refetch: execute };
}

// ==================== useUsers Hook ====================
/**
 * Hook لإدارة المستخدمين
 */
export function useUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await api.getUsers();
    if (response.success && response.data) {
      setUsers(response.data.users || []);
    } else {
      setError(response.error || 'فشل جلب المستخدمين');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const createUser = async (userData: any) => {
    const response = await api.createUser(userData);
    if (response.success) {
      await fetchUsers();
    }
    return response;
  };

  const updateUser = async (email: string, userData: any) => {
    const response = await api.updateUser(email, userData);
    if (response.success) {
      await fetchUsers();
    }
    return response;
  };

  const deleteUser = async (email: string, soft = true) => {
    const response = soft
      ? await api.softDeleteUser(email)
      : await api.hardDeleteUser(email);
    if (response.success) {
      await fetchUsers();
    }
    return response;
  };

  const restoreUser = async (email: string) => {
    const response = await api.restoreUser(email);
    if (response.success) {
      await fetchUsers();
    }
    return response;
  };

  const changeStatus = async (email: string, status: string) => {
    const response = await api.changeUserStatus(email, status);
    if (response.success) {
      await fetchUsers();
    }
    return response;
  };

  return {
    users,
    loading,
    error,
    refetch: fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    restoreUser,
    changeStatus,
  };
}

// ==================== useProducts Hook ====================
/**
 * Hook لإدارة المنتجات
 */
export function useProducts(filters?: any) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await api.getProducts(filters);
    if (response.success && response.data) {
      setProducts(response.data);
    } else {
      setError(response.error || 'فشل جلب المنتجات');
    }

    setLoading(false);
  }, [filters]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const createProduct = async (productData: any) => {
    const response = await api.createProduct(productData);
    if (response.success) {
      await fetchProducts();
    }
    return response;
  };

  const updateProduct = async (productId: string, productData: any) => {
    const response = await api.updateProduct(productId, productData);
    if (response.success) {
      await fetchProducts();
    }
    return response;
  };

  const deleteProduct = async (productId: string) => {
    const response = await api.deleteProduct(productId);
    if (response.success) {
      await fetchProducts();
    }
    return response;
  };

  return {
    products,
    loading,
    error,
    refetch: fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
  };
}

// ==================== useForm Hook ====================
/**
 * Hook لإدارة النماذج
 */
export function useForm<T extends Record<string, any>>(
  initialValues: T,
  onSubmit: (values: T) => Promise<void>
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [loading, setLoading] = useState(false);

  const handleChange = (name: keyof T, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    // مسح الخطأ عند التعديل
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setLoading(true);
    setErrors({});

    try {
      await onSubmit(values);
    } catch (error: any) {
      console.error('Form submission error:', error);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setValues(initialValues);
    setErrors({});
  };

  return {
    values,
    errors,
    loading,
    handleChange,
    handleSubmit,
    reset,
    setValues,
    setErrors,
  };
}

// ==================== useLocalStorage Hook ====================
/**
 * Hook للتعامل مع localStorage
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue] as const;
}

// ==================== Re-exports من الملفات الموجودة ====================
export { useTableData } from './useTableData';
export { useDelete } from './useDelete';
