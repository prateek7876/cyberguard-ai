"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "../../lib-auth";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/v1/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Admin login failed");
      }

      localStorage.setItem("cyberguard_admin_token", data.access_token);
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#05080d] text-white flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,200,255,.08),transparent_40%)]" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-3xl">
            🛡️
          </div>

          <h1 className="text-3xl font-bold">
            CyberGuard <span className="text-cyan-400">AI</span>
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Secure Administrator Portal
          </p>
        </div>

        <form
          onSubmit={login}
          className="rounded-3xl border border-white/10 bg-[#0b111a] p-7 shadow-2xl"
        >
          <div className="mb-6">
            <h2 className="text-xl font-bold">Admin Login</h2>
            <p className="mt-1 text-sm text-gray-500">
              Authorized administrators only
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <label className="mb-2 block text-sm text-gray-400">
            Admin Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@cyberguard.ai"
            className="mb-5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none placeholder:text-gray-700 focus:border-cyan-400/50"
          />

          <label className="mb-2 block text-sm text-gray-400">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mb-6 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none placeholder:text-gray-700 focus:border-cyan-400/50"
          />

          <button
            disabled={loading}
            className="w-full rounded-xl bg-cyan-400 px-4 py-3 font-bold text-black transition hover:bg-cyan-300 disabled:opacity-50"
          >
            {loading ? "Authenticating..." : "Enter Admin Console →"}
          </button>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-600">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Protected administrator access
          </div>
        </form>
      </div>
    </main>
  );
}
