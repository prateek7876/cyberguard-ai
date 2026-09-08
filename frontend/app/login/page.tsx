"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL, saveSession } from "../lib-auth";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {

      const response = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
});


      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || "Invalid email or password.");
      }

      saveSession(data.access_token, data.email);
      router.push("/");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to CyberGuard AI."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070b14] px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15 text-3xl">
            🛡️
          </div>

          <h1 className="text-2xl font-bold">
            CyberGuard <span className="text-blue-400">AI</span>
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Sign in to your security dashboard
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-400"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-500 py-3 font-semibold text-white transition hover:bg-blue-400 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Don't have an account?{" "}
          <a
            href="/signup"
            className="font-medium text-blue-400 hover:text-blue-300"
          >
            Create Account
          </a>
        </p>

        <a
          href="/"
          className="mt-5 block text-center text-xs text-slate-500 hover:text-slate-300"
        >
          ← Back to CyberGuard AI
        </a>
      </div>
    </main>
  );
}
