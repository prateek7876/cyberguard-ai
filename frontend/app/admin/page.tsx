"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL, getToken } from "../lib-auth";

type User = {
  id: string;
  email: string;
  plan: string;
  monthly_scan_count: number;
  usage_month: string;
  is_admin: boolean;
  created_at: string;
};

type Stats = {
  users: {
    total_users: number;
    pro_users: number;
    free_users: number;
    admin_users: number;
  };
  scans: {
    total_scans: number;
    high_risk: number;
    critical_risk: number;
  };
};

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    setMessage("");

    try {
      const token = getToken();

      if (!token) {
        throw new Error("Please login again");
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const [statsRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/admin/stats`, { headers }),
        fetch(`${API_URL}/api/v1/admin/users`, { headers }),
      ]);

      if (!statsRes.ok || !usersRes.ok) {
        throw new Error("Unable to load admin data");
      }

      setStats(await statsRes.json());
      const data = await usersRes.json();
      setUsers(data.users || []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to load admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch = u.email
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesFilter =
        filter === "all" ||
        (filter === "pro" && u.plan === "pro") ||
        (filter === "free" && u.plan !== "pro") ||
        (filter === "admin" && u.is_admin);

      return matchesSearch && matchesFilter;
    });
  }, [users, search, filter]);

  const action = async (
    url: string,
    success: string
  ) => {
    try {
      const token = getToken();

      const res = await fetch(`${API_URL}${url}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Action failed");

      setMessage(success);
      await load();
    } catch {
      setMessage("Action failed. Please try again.");
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#070b12] text-white p-6 md:p-10">
        <div className="mx-auto max-w-7xl animate-pulse">
          <div className="h-10 w-72 rounded bg-white/10 mb-3" />
          <div className="h-5 w-96 rounded bg-white/5 mb-10" />
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((x) => (
              <div key={x} className="h-32 rounded-2xl bg-white/5" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (message && !stats) {
    return (
      <main className="min-h-screen bg-[#070b12] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-red-500/20 bg-[#0d131d] p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-2xl">
            ⚠️
          </div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="mt-3 text-sm text-red-300">{message}</p>
          <button
            onClick={load}
            className="mt-6 rounded-xl bg-white px-6 py-3 font-semibold text-black hover:bg-gray-200"
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070b12] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#090e17]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-400/20 text-xl">
              🛡️
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">
                CyberGuard <span className="text-cyan-400">AI</span>
              </div>
              <div className="text-xs text-gray-500">ADMIN CONSOLE</div>
            </div>
          </div>

          <button
            onClick={load}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-white/10"
          >
            ↻ Refresh
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
        {/* Title */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Security Overview
            </h1>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              ● SYSTEM ONLINE
            </span>
          </div>
          <p className="mt-2 text-gray-500">
            Monitor users, scans and platform security activity.
          </p>
        </div>

        {/* Toast */}
        {message && stats && (
          <div className="mb-6 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200">
            {message}
          </div>
        )}

        {/* Stats */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Stat title="Total Users" value={stats?.users.total_users ?? 0} icon="👥" />
          <Stat title="Pro Users" value={stats?.users.pro_users ?? 0} icon="⭐" />
          <Stat title="Free Users" value={stats?.users.free_users ?? 0} icon="○" />
          <Stat title="Total Scans" value={stats?.scans.total_scans ?? 0} icon="⌁" />
          <Stat
            title="Critical Threats"
            value={stats?.scans.critical_risk ?? 0}
            icon="⚠"
            danger
          />
        </section>

        {/* Security summary */}
        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <Summary
            title="High Risk Scans"
            value={stats?.scans.high_risk ?? 0}
            label="Requires attention"
          />
          <Summary
            title="Critical Scans"
            value={stats?.scans.critical_risk ?? 0}
            label="Immediate attention"
            danger
          />
          <Summary
            title="Administrators"
            value={stats?.users.admin_users ?? 0}
            label="Privileged accounts"
          />
        </section>

        {/* Users */}
        <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-[#0b111a] shadow-2xl">
          <div className="border-b border-white/10 p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-bold">User Management</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {filteredUsers.length} users shown
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search email..."
                  className="w-full sm:w-64 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-gray-600 focus:border-cyan-400/40"
                />

                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="rounded-xl border border-white/10 bg-[#111923] px-4 py-2.5 text-sm text-gray-300 outline-none"
                >
                  <option value="all">All Users</option>
                  <option value="pro">Pro</option>
                  <option value="free">Free</option>
                  <option value="admin">Admins</option>
                </select>
              </div>
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead className="bg-white/[0.025] text-left text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Plan</th>
                  <th className="px-6 py-4">Scans</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-white/[0.025]">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400/10 text-sm font-bold text-cyan-300">
                          {user.email[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{user.email}</div>
                          <div className="text-xs text-gray-600">
                            {new Date(user.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <Badge pro={user.plan === "pro"}>
                        {user.plan === "pro" ? "PRO" : "FREE"}
                      </Badge>
                    </td>

                    <td className="px-6 py-5 font-semibold">
                      {user.monthly_scan_count}
                    </td>

                    <td className="px-6 py-5">
                      {user.is_admin ? (
                        <span className="text-cyan-300">🛡 Admin</span>
                      ) : (
                        <span className="text-gray-500">User</span>
                      )}
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() =>
                            action(
                              `/api/v1/admin/users/${user.id}/plan?plan=${
                                user.plan === "pro" ? "free" : "pro"
                              }`,
                              "Plan updated successfully"
                            )
                          }
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10"
                        >
                          {user.plan === "pro" ? "Make Free" : "Make Pro"}
                        </button>

                        <button
                          disabled={user.is_admin && stats?.users.admin_users === 1}
                          onClick={() =>
                            action(
                              `/api/v1/admin/users/${user.id}/admin?enabled=${!user.is_admin}`,
                              user.is_admin
                                ? "Admin access removed"
                                : "Admin access granted"
                            )
                          }
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          {user.is_admin ? "Remove Admin" : "Make Admin"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 p-4 md:hidden">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="rounded-xl border border-white/10 bg-white/[0.025] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-300">
                      {user.email[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {user.email}
                      </div>
                      <div className="text-xs text-gray-600">
                        {user.monthly_scan_count} scans
                      </div>
                    </div>
                  </div>
                  <Badge pro={user.plan === "pro"}>
                    {user.plan === "pro" ? "PRO" : "FREE"}
                  </Badge>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() =>
                      action(
                        `/api/v1/admin/users/${user.id}/plan?plan=${
                          user.plan === "pro" ? "free" : "pro"
                        }`,
                        "Plan updated"
                      )
                    }
                    className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold"
                  >
                    {user.plan === "pro" ? "Make Free" : "Make Pro"}
                  </button>

                  <button
                    disabled={user.is_admin && stats?.users.admin_users === 1}
                    onClick={() =>
                      action(
                        `/api/v1/admin/users/${user.id}/admin?enabled=${!user.is_admin}`,
                        "Admin status updated"
                      )
                    }
                    className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold disabled:opacity-30"
                  >
                    {user.is_admin ? "Remove Admin" : "Make Admin"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredUsers.length === 0 && (
            <div className="p-12 text-center text-sm text-gray-500">
              No users found.
            </div>
          )}
        </section>

        <div className="py-8 text-center text-xs text-gray-600">
          CyberGuard AI • Admin Console • Protected System
        </div>
      </div>
    </main>
  );
}

function Stat({
  title,
  value,
  icon,
  danger = false,
}: {
  title: string;
  value: number;
  icon: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b111a] p-5 shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className="text-[10px] uppercase tracking-widest text-gray-600">
          Live
        </span>
      </div>
      <div className={`mt-5 text-3xl font-bold ${danger ? "text-red-400" : ""}`}>
        {value}
      </div>
      <div className="mt-1 text-sm text-gray-500">{title}</div>
    </div>
  );
}

function Summary({
  title,
  value,
  label,
  danger = false,
}: {
  title: string;
  value: number;
  label: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b111a] p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{title}</span>
        <span className={danger ? "text-red-400" : "text-cyan-400"}>●</span>
      </div>
      <div className="mt-3 text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-gray-600">{label}</div>
    </div>
  );
}

function Badge({
  pro,
  children,
}: {
  pro: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[10px] font-bold tracking-wider ${
        pro
          ? "bg-amber-400/10 text-amber-300 border border-amber-400/20"
          : "bg-white/5 text-gray-400 border border-white/10"
      }`}
    >
      {children}
    </span>
  );
}
