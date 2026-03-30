"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Bot, Loader2 } from "lucide-react";

import { loginUser } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import type { LoginRequest } from "@/types";

interface FormValues {
  email: string;
  password: string;
}

function validate(v: FormValues): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))
    return "Please enter a valid email address.";
  if (!v.password) return "Password is required.";
  return null;
}

export default function SignInPage() {
  const router = useRouter();
  const { isLoading, error, setLoading, setError, setUser, setToken } =
    useAuthStore();

  const [values, setValues] = useState<FormValues>({
    email: "",
    password: "",
  });
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldError(null);
    setError(null);

    const validationError = validate(values);
    if (validationError) {
      setFieldError(validationError);
      return;
    }

    setLoading(true);
    try {
      const payload: LoginRequest = {
        email: values.email,
        password: values.password,
      };
      const response = await loginUser(payload);
      setToken(response.access_token);
      setUser(response.user);
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  const displayError = fieldError || error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        {/* Back link */}
        <div className="mb-6">
          <Link
            href="/"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            &larr; Back to chat
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Sign in
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Welcome back to AiRAG
            </p>
          </div>

          {/* Error banner */}
          {displayError && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg px-4 py-3 text-sm">
              {displayError}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={values.email}
                onChange={handleChange}
                placeholder="jane@example.com"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={values.password}
                onChange={handleChange}
                placeholder="Your password"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className={clsx(
                "w-full py-2.5 rounded-lg font-medium text-white transition-colors flex items-center justify-center gap-2",
                isLoading
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
