export interface User {
  id: string;  // Auth0のsub（例: "auth0|507f1f77bcf86cd799439011"）
  email: string;
  first_name: string;
  last_name: string;
}

export interface AuthState {
  user: User | null;
  isInitialized: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
  setInitialized: (value: boolean) => void;
}