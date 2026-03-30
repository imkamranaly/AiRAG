"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Bot, Loader2 } from "lucide-react";

import { registerUser } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import type { RegisterRequest } from "@/types";

interface FormValues {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

function validate(v: FormValues): string | null {
  if (!v.fullName.trim()) return "Full name is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))
    return "Please enter a valid email address.";
  if (v.password.length < 8) return "Password must be at least 8 characters.";
  if (v.password !== v.confirmPassword) return "Passwords do not match.";
  return null;
}

export default function SignUpPage() {
  const router = useRouter();
  const { isLoading, error, setLoading, setError, setUser } = useAuthStore();

  const [values, setValues] = useState<FormValues>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

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
      const payload: RegisterRequest = {
        email: values.email,
        password: values.password,
        full_name: values.fullName,
      };
      const user = await registerUser(payload);
      setUser(user);
      setSuccess(true);
      timerRef.current = setTimeout(() => router.push("/"), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed.");
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
            ← Back to chat
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Create an account
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Start chatting with your documents
            </p>
          </div>

          {/* Success banner */}
          {success && (
            <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-lg px-4 py-3 text-sm">
              Account created! Redirecting…
            </div>
          )}

          {/* Error banner */}
          {displayError && !success && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg px-4 py-3 text-sm">
              {displayError}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                required
                value={values.fullName}
                onChange={handleChange}
                placeholder="Jane Doe"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>

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
                autoComplete="new-password"
                required
                value={values.password}
                onChange={handleChange}
                placeholder="Min. 8 characters"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={values.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter password"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || success}
              className={clsx(
                "w-full py-2.5 rounded-lg font-medium text-white transition-colors flex items-center justify-center gap-2",
                isLoading || success
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                "Create account"
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{" "}
            <Link
              href="/signin"
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
