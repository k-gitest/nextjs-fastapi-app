import { create } from "zustand";

interface TodoSearchState {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const useTodoSearchState = create<TodoSearchState>((set) => ({
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),
}));