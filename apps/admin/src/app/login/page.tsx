"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = supabaseBrowser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const next = searchParams.get("next") || "/admin";
        router.push(next);
      }
    });
  }, [router, searchParams, supabase]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMsg(`Error: ${error.message}`);
        setLoading(false);
      } else {
        // Session is established, redirect immediately
        const next = searchParams.get("next") || "/admin";
        // Small delay to ensure session is saved
        setTimeout(() => {
          window.location.href = next;
        }, 100);
      }
    } catch {
      setMsg("An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-white text-black p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold">Admin Login</h1>
        <p className="mt-1 text-sm text-black/60">Sign in to manage inventory.</p>

        <label className="mt-4 block text-sm">
          Email
          <input
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:ring-2 focus:ring-black/80"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            autoComplete="email"
          />
        </label>

        <label className="mt-3 block text-sm">
          Password
          <input
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:ring-2 focus:ring-black/80"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            autoComplete="current-password"
          />
        </label>

        <button
          type="submit"
          className="mt-5 w-full rounded-lg bg-black px-3 py-2 text-white font-medium disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        {msg && (
          <p
            className={`mt-3 text-sm ${msg.includes("Error") ? "text-red-600" : "text-green-600"}`}
          >
            {msg}
          </p>
        )}
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-white text-black p-6">
          <div className="text-center">Loading...</div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
