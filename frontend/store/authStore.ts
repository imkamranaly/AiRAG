"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { AuthState, UserResponse } from "@/types";

const TOKEN_KEY = "airag_access_token";

function loadToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

interface AuthStore extends AuthState {
  setUser: (user: UserResponse | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (v: boolean) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: false,
  error: null,
};

export const useAuthStore = create<AuthStore>()(
  devtools(
    (set) => ({
      ...initialState,
      token: loadToken(),
      setUser: (user) => set({ user, error: null }),
      setToken: (token) => {
        if (typeof window !== "undefined") {
          try {
            if (token === null) {
              localStorage.removeItem(TOKEN_KEY);
            } else {
              localStorage.setItem(TOKEN_KEY, token);
            }
          } catch {
            // ignore storage errors
          }
        }
        set({ token });
      },
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error, isLoading: false }),
      reset: () => {
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem(TOKEN_KEY);
          } catch {
            // ignore storage errors
          }
        }
        set(initialState);
      },
    }),
    { name: "auth-store" }
  )
);
