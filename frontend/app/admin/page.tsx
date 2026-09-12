"use client";

import { useEffect, useState } from "react";
import { API_URL, getToken } from "../lib-auth";

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

type User = {
  id: string;
  email: string;
  plan: string;
  monthly_scan_count: number;
  usage_month: string;
  is_admin: boolean;
  created_at: string;
};

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const token = getToken();

    if (!token) {
      setError("Please login first.");
      setLoading(false);
      return;
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    try {
      const [statsRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/admin/stats`, { headers }),
        fetch(`${API_URL}/api/v1/admin/users`, { headers }),
      ]);

      if (statsRes.status === 403 || usersRes.status === 403) {
        throw new Error("Admin access required.");
      }

      if (!statsRes.ok || !usersRes.ok) {
        throw new Error("Unable to load admin data.");
      }

      setStats(await statsRes.json());
      setUsers((await usersRes.json()).users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function changePlan(id: string, plan: string) {
    const token = getToken();

    await fetch(
      `${API_URL}/api/v1/admin/users/${id}/plan?plan=${plan}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    load();
  }

  async function changeAdmin(id: string, enabled: boolean) {
    const token = getToken();

    await fetch(
      `${API_URL}/api/v1/admin/users/${id}/admin?enabled=${enabled}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    load();
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <main className="min-h-screen p-8">Loading admin panel...</main>;
  }

  if (error) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-3xl mx-auto rounded-xl border p-6">
          <h1 className="text-2xl font-bold mb-2">Admin Panel</h1>
          <p className="text-red-600">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">CyberGuard AI Admin</h1>
          <p className="text-gray-500 mt-1">
            System overview and user management
          </p>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <Card title="Total Users" value={stats.users.total_users} />
            <Card title="Pro Users" value={stats.users.pro_users} />
            <Card title="Free Users" value={stats.users.free_users} />
            <Card title="Total Scans" value={stats.scans.total_scans} />
            <Card
              title="Critical Threats"
              value={stats.scans.critical_risk}
            />
          </div>
        )}

        <div className="rounded-xl border overflow-x-auto">
          <div className="p-5 border-b">
            <h2 className="text-xl font-semibold">Users</h2>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-4">Email</th>
                <th className="p-4">Plan</th>
                <th className="p-4">Scans</th>
                <th className="p-4">Admin</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b">
                  <td className="p-4">{user.email}</td>
                  <td className="p-4 uppercase">{user.plan}</td>
                  <td className="p-4">{user.monthly_scan_count}</td>
                  <td className="p-4">
                    {user.is_admin ? "Yes" : "No"}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2 flex-wrap">
                      <button
                        className="px-3 py-1 rounded border"
                        onClick={() =>
                          changePlan(
                            user.id,
                            user.plan === "pro" ? "free" : "pro"
                          )
                        }
                      >
                        {user.plan === "pro"
                          ? "Make Free"
                          : "Make Pro"}
                      </button>

                      <button
                        className="px-3 py-1 rounded border"
                        onClick={() =>
                          changeAdmin(user.id, !user.is_admin)
                        }
                      >
                        {user.is_admin
                          ? "Remove Admin"
                          : "Make Admin"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function Card({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border p-5">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}
