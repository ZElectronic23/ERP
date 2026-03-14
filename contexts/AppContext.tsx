/**
 * App Context - إدارة مركزية للـ state العام (بدون لغة)
 */

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';

// ==================== TYPES ====================
interface User {
  email: string;
  full_name?: string;
  profile_image?: string;
  role_key?: string;
  is_admin?: boolean;
}

interface Notification {
  message: string;
  type: 'success' | 'error' | 'info';
  id: string;
}

interface AppContextType {
  // Current User
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  isAuthenticated: boolean;

  // Loading States
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Notifications
  showNotification: (message: string, type: 'success' | 'error' | 'info') => void;
  notifications: Notification[];
  removeNotification: (id: string) => void;

  // Theme
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

// ==================== CONTEXT ====================
const AppContext = createContext<AppContextType | undefined>(undefined);

// ==================== PROVIDER ====================
export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // ===== Load dark mode from localStorage =====
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dark-mode');
      if (saved !== null) {
        setIsDarkMode(saved === 'true');
      }
    } catch (e) {
      console.error('Failed to load dark mode:', e);
    }
  }, []);

  // ===== Fetch current user =====
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('email', user.email)
          .single();

        if (data) {
          setCurrentUser({
            email: data.email,
            full_name: data.full_name,
            profile_image: data.profile_image,
            role_key: data.role_key,
            is_admin: data.is_admin,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ===== Dark Mode Functions =====
  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    try {
      localStorage.setItem('dark-mode', String(newMode));
    } catch (e) {
      console.error('Failed to save dark mode:', e);
    }
  };

  // ===== Notification Functions =====
  const showNotification = (
    message: string,
    type: 'success' | 'error' | 'info' = 'info'
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    const notification: Notification = { message, type, id };

    setNotifications((prev) => [...prev, notification]);

    setTimeout(() => {
      removeNotification(id);
    }, 3000);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const value: AppContextType = {
    currentUser,
    setCurrentUser,
    isAuthenticated: !!currentUser,
    isLoading,
    setIsLoading,
    showNotification,
    notifications,
    removeNotification,
    isDarkMode,
    toggleDarkMode,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
      {/* Notifications Container */}
      <div className="fixed top-4 left-4 right-4 z-[999999] flex flex-col gap-2 pointer-events-none">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-2xl border animate-slide-in max-w-md mx-auto ${notification.type === 'success'
                ? 'bg-green-500/90 border-green-400 text-white'
                : notification.type === 'error'
                  ? 'bg-red-500/90 border-red-400 text-white'
                  : 'bg-blue-500/90 border-blue-400 text-white'
              }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === 'success' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {notification.type === 'info' && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span>{notification.message}</span>
            </div>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

// ==================== HOOK ====================
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}