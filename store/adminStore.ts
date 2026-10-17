"use client";

import { create } from "zustand";

interface AdminState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  sidebarOpen: false,
  setSidebarOpen(open) {
    set({ sidebarOpen: open });
  }
}));
