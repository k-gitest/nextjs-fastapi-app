import { create } from 'zustand';
import type { AuthState } from '../features/auth/types/index';

/**
 * Cookie認証専用のAuthストア
 * トークンはサーバー側のCookieで管理されるため、クライアント側では保存しない
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isInitialized: false,  // 👈 初期値は false

  setUser: (user) => set({ user: user }),

  logout: () => {
    set({ user: null });
    // 🔥 Cookieの削除はサーバー側で行う（/auth/logout/ を呼び出す）
  },

  setInitialized: (value) => set({ isInitialized: value }),
}));