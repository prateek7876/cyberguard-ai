"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL, saveSession } from "../lib-auth";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Signup failed.");
      }

      saveSession(data.access_token, data.email);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="text-5xl mb-4">🛡️</div>
          <h1 className="text-3xl font-bold text-white">CyberGuard AI</h1>
          <p className="mt-2 text-slate-400">
            Create your security analyst account
          </p>
        </div>

        <form
          onSubmit={handleSignup}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-7 shadow-2xl"
        >
          <h2 className="text-xl font-semibold text-white mb-6">
            Create account
          </h2>

          {error && (
            <div className="mb-5 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <label className="block text-sm text-slate-300 mb-2">
            Email
          </label>

          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500"
            placeholder="you@example.com"
          />

          <label className="block text-sm text-slate-300 mt-5 mb-2">
            Password
          </label>

          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500"
            placeholder="Minimum 8 characters"
          />

          <label className="block text-sm text-slate-300 mt-5 mb-2">
            Confirm password
          </label>

          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500"
            placeholder="Repeat password"
          />

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-cyan-500 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <a
              href="/login"
              className="font-medium text-cyan-400 hover:text-cyan-300"
            >
              Sign in
            </a>
          </p>
        </form>
      </div>
    </main>
  );
}
