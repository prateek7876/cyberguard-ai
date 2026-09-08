"use client";

declare global {
  interface Window {
    Razorpay?: new (
      options: Record<string, unknown>
    ) => {
      open: () => void;
    };
  }
}


import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { clearSession, getToken, getUserEmail } from "./lib-auth";

type ScanType = "url" | "ip" | "hash" | "email" | "log";

type ThreatIntel = {
  status?: string;
  source?: string;
  analysis_status?: string;
  message?: string;
  stats?: {
    malicious?: number;
    suspicious?: number;
    harmless?: number;
    undetected?: number;
    timeout?: number;
  };
};

type ScanResult = {
  scan_id: string;
  scan_type: ScanType;
  risk_score: number;
  risk_level: string;
  status: string;
  findings: string[];
  recommendations: string[];
  threat_intelligence?: ThreatIntel | null;
  ai_analysis?: string | null;
};

type HistoryItem = {
  scan_id: string;
  scan_type: string;
  risk_score: number;
  risk_level: string;
  status: string;
  created_at?: string;
};

type ScanDetails = {
  scan_id: string;
  scan_type: string;
  input_data: string;
  risk_score: number;
  risk_level: string;
  status: string;
  findings: string[];
  recommendations: string[];
  threat_intelligence: ThreatIntel | null;
  ai_analysis: string;
  created_at?: string;
};

type UsageInfo = {
  plan: string;
  monthly_scan_count: number;
  monthly_scan_limit: number;
  scans_remaining: number;
  usage_month: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";

const scanTabs: { id: ScanType; label: string; icon: string }[] = [
  { id: "url", label: "URL / Domain", icon: "🌐" },
  { id: "ip", label: "IP Address", icon: "📡" },
  { id: "hash", label: "File Hash", icon: "🔐" },
  { id: "email", label: "Phishing Email", icon: "✉️" },
  { id: "log", label: "Security Log", icon: "📋" },
];

function getRiskClass(level: string) {
  switch (level.toLowerCase()) {
    case "low":
      return "risk-low";
    case "moderate":
      return "risk-moderate";
    case "medium":
      return "risk-medium";
    case "high":
      return "risk-high";
    case "critical":
      return "risk-critical";
    default:
      return "risk-low";
  }
}

function getRiskIcon(level: string) {
  switch (level.toLowerCase()) {
    case "critical":
    case "high":
      return "⚠️";
    case "medium":
    case "moderate":
      return "🟡";
    default:
      return "🟢";
  }
}

function formatDate(date?: string) {
  if (!date) return "-";

  try {
    return new Date(date).toLocaleString();
  } catch {
    return date;
  }
}

export default function Home() {
  const [scanType, setScanType] = useState<ScanType>("url");
  const [inputData, setInputData] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStage, setScanStage] = useState("Initializing security engine...");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [selectedScan, setSelectedScan] = useState<ScanDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  async function loadUsage() {
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      setUsage(data);
    } catch {
      // Usage failure should not break the dashboard.
    }
  }

  async function loadHistory() {
    const token = getToken();

    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/v1/history`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      setHistory(data);
    } catch {
      // History failure should not break scanning.
    }
  }

  useEffect(() => {
    setUserEmail(getUserEmail());
    loadUsage();
    loadHistory();
  }, []);

  function handleLogout() {
    clearSession();
    window.location.href = "/login";
  }

  async function upgradeToPro() {
    const token = getToken();

    if (!token) {
      window.location.href = "/login";
      return;
    }

    setPaymentLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/v1/payments/create-order`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || "Unable to start Pro upgrade.");
      }

      if (!data.key_id || !data.order_id) {
        throw new Error("Invalid payment order received.");
      }

      const Razorpay = (
        window as unknown as {
          Razorpay?: new (options: Record<string, unknown>) => {
            open: () => void;
            on?: (event: string, callback: (response: unknown) => void) => void;
          };
        }
      ).Razorpay;

      if (!Razorpay) {
        throw new Error(
          "Razorpay checkout is not loaded. Please refresh the page and try again."
        );
      }

      const checkout = new Razorpay({
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: "CyberGuard AI",
        description: "CyberGuard AI Pro",
        order_id: data.order_id,
        prefill: {
          email: userEmail || "",
        },
        theme: {
          color: "#3b82f6",
        },
        handler: async (payment: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verifyResponse = await fetch(
              `${API_URL}/api/v1/payments/verify`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payment),
              }
            );

            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok) {
              throw new Error(
                verifyData?.detail || "Payment verification failed."
              );
            }

            await loadUsage();
            setError("");
            alert("🎉 CyberGuard AI Pro activated successfully!");
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Payment verification failed."
            );
          }
        },
      });

      checkout.open();
    } catch (err) {
      console.error("Razorpay error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start Pro upgrade."
      );
    } finally {
      setPaymentLoading(false);
    }
  }

  async function startScan() {
    const token = getToken();

    if (!token) {
      window.location.href = "/login";
      return;
    }
    if (!inputData.trim()) {
      setError("Please enter something to analyze.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/scans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken() || ""}`,
        },
        body: JSON.stringify({
          scan_type: scanType,
          input_data: inputData.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail || "Security scan failed. Please try again."
        );
      }

      setResult(data);
      await Promise.all([loadHistory(), loadUsage()]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the security engine."
      );
    } finally {
      setLoading(false);
    }
  }

  async function deleteScan(scanId: string) {
    const token = getToken();

    if (!token) {
      window.location.href = "/login";
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this scan?"
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API_URL}/api/v1/scans/${scanId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || "Unable to delete scan.");
      }

      setSelectedScan(null);
      await loadHistory();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete scan."
      );
    }
  }

  async function openScanDetails(scanId: string) {
    const token = getToken();

    if (!token) {
      window.location.href = "/login";
      return;
    }

    setDetailsLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/v1/scans/${scanId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || "Unable to load scan details.");
      }

      setSelectedScan(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load scan details."
      );
    } finally {
      setDetailsLoading(false);
    }
  }

  function clearScan() {
    setInputData("");
    setResult(null);
    setError("");
  }

  const stats = result?.threat_intelligence?.stats;

  const filteredHistory = history.filter((item) => {
    const typeMatch =
      typeFilter === "all" || item.scan_type.toLowerCase() === typeFilter;

    const query = searchQuery.trim().toLowerCase();

    const searchMatch =
      !query ||
      item.scan_type.toLowerCase().includes(query) ||
      item.risk_level.toLowerCase().includes(query) ||
      item.scan_id.toLowerCase().includes(query);

    const risk = item.risk_level.toLowerCase();
    const riskMatch =
      riskFilter === "all" ||
      (riskFilter === "low" && risk === "low") ||
      (riskFilter === "moderate" && risk === "moderate") ||
      (riskFilter === "medium" && risk === "medium") ||
      (riskFilter === "high" && risk === "high") ||
      (riskFilter === "critical" && risk === "critical");

    return typeMatch && riskMatch && searchMatch;
  });

  const totalScans = history.length;
  const lowRisk = history.filter(
    (item) => item.risk_level.toLowerCase() === "low"
  ).length;
  const moderateRisk = history.filter(
    (item) => item.risk_level.toLowerCase() === "moderate"
  ).length;
  const mediumRisk = history.filter(
    (item) => item.risk_level.toLowerCase() === "medium"
  ).length;
  const highRisk = history.filter(
    (item) => item.risk_level.toLowerCase() === "high"
  ).length;
  const criticalRisk = history.filter(
    (item) => item.risk_level.toLowerCase() === "critical"
  ).length;

  const averageRisk =
    totalScans > 0
      ? Math.round(
          history.reduce((sum, item) => sum + item.risk_score, 0) / totalScans
        )
      : 0;

  const scanTypeAnalytics = ["url", "ip", "hash", "email", "log"].map((type) => {
    const scans = history.filter(
      (item) => item.scan_type.toLowerCase() === type
    );

    const highPlus = scans.filter((item) =>
      ["high", "critical"].includes(item.risk_level.toLowerCase())
    ).length;

    const avg =
      scans.length > 0
        ? Math.round(
            scans.reduce((sum, item) => sum + item.risk_score, 0) /
              scans.length
          )
        : 0;

    return {
      type,
      count: scans.length,
      highPlus,
      avg,
    };
  });

  return (
    <main className="min-h-screen bg-[#070b14] text-white">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #070b14;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .glass {
          background: rgba(15, 23, 42, 0.78);
          border: 1px solid rgba(148, 163, 184, 0.12);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
          backdrop-filter: blur(16px);
        }

        .risk-low {
          color: #34d399;
        }

        .risk-moderate {
          color: #facc15;
        }

        .risk-medium {
          color: #fb923c;
        }

        .risk-high {
          color: #f87171;
        }

        .risk-critical {
          color: #ef4444;
        }

        .markdown-report h3 {
          font-size: 1rem;
          font-weight: 700;
          margin-top: 1.2rem;
          margin-bottom: 0.55rem;
          color: white;
        }

        .markdown-report h3:first-child {
          margin-top: 0;
        }

        .markdown-report p {
          color: #cbd5e1;
          line-height: 1.7;
          margin: 0.5rem 0;
        }

        .markdown-report ul {
          margin: 0.5rem 0;
          padding-left: 1.4rem;
        }

        .markdown-report li {
          color: #cbd5e1;
          line-height: 1.7;
          margin: 0.25rem 0;
        }

        .markdown-report strong {
          color: white;
        }

        .markdown-report code {
          background: rgba(51, 65, 85, 0.55);
          padding: 0.12rem 0.35rem;
          border-radius: 0.3rem;
          color: #93c5fd;
        }

        .markdown-report hr {
          border: 0;
          border-top: 1px solid rgba(148, 163, 184, 0.12);
          margin: 1rem 0;
        }
      `}</style>

      {/* Header */}
      <header className="border-b border-white/10 bg-[#080d18]/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 text-2xl ring-1 ring-blue-400/20">
              🛡️
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight">
                CyberGuard <span className="text-blue-400">AI</span>
              </h1>
              <p className="text-xs text-slate-500">
                Intelligent Defensive Security Platform
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-4 py-2 text-xs text-emerald-300 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Security Engine Online
            </div>

            {userEmail ? (
              <>
                <div className="hidden max-w-[220px] truncate rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 sm:block">
                  👤 {userEmail}
                </div>
                <button
                  onClick={handleLogout}
                  className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-400/10"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <a
                  href="/login"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-white/10"
                >
                  Login
                </a>
                <a
                  href="/signup"
                  className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-400"
                >
                  Sign Up
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Hero */}
        <section className="mb-8">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-400">
            <span>AI-POWERED THREAT ANALYSIS</span>
          </div>

          <h2 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
            Analyze threats.
            <br />
            <span className="text-slate-400">
              Make safer security decisions.
            </span>
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Analyze URLs, IP addresses, file hashes, phishing emails and
            security logs using deterministic risk scoring, threat
            intelligence and AI-assisted defensive analysis.
          </p>
        </section>

        {usage && (
          <section className="mb-8 rounded-2xl border border-blue-400/10 bg-blue-400/[0.025] p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-400">
                    Account Usage
                  </p>
                  <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 text-[10px] font-bold uppercase text-blue-300">
                    {usage.plan} plan
                  </span>
                </div>

                <h3 className="mt-2 text-xl font-bold text-white">
                  {usage.monthly_scan_count} / {usage.monthly_scan_limit} scans used
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  {usage.scans_remaining} scans remaining this month
                </p>
              </div>

              <div className="w-full max-w-md">
                <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider">
                  <span className="text-slate-600">Monthly usage</span>
                  <span className="text-slate-500">
                    {Math.round(
                      Math.min(
                        (usage.monthly_scan_count / usage.monthly_scan_limit) * 100,
                        100
                      )
                    )}%
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-blue-400 transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        (usage.monthly_scan_count / usage.monthly_scan_limit) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] text-slate-600">
                    Resets monthly
                  </span>

                  {usage.plan.toLowerCase() === "free" && (
                    <button
                      type="button"
                      onClick={upgradeToPro}
                      disabled={paymentLoading}
                      className="rounded-lg border border-purple-400/20 bg-purple-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-300 transition hover:bg-purple-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {paymentLoading ? "Opening..." : "Upgrade to Pro"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Security Analytics */}
        <section className="mb-8">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
              Security Analytics
            </p>
            <h2 className="mt-1 text-xl font-bold text-white">
              Security Overview
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Live intelligence from your security assessments
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Total Scans", totalScans, "🛡️", "All assessments"],
              ["Low Risk", lowRisk, "🟢", "Safe indicators"],
              ["Moderate", moderateRisk, "🟡", "Needs review"],
              ["High / Critical", highRisk + criticalRisk, "🔴", "Priority threats"],
              ["Average Risk", `${averageRisk}/100`, "📊", "Overall posture"],
            ].map(([label, value, icon, description]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition hover:border-cyan-400/20 hover:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{icon}</span>
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-600">
                    Lifetime
                  </span>
                </div>

                <p className="mt-5 text-xs text-slate-500">{label}</p>

                <p className="mt-1 text-2xl font-bold text-white">
                  {value}
                </p>

                <p className="mt-2 text-[11px] text-slate-600">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Risk & Scan Type Analytics */}
        <section className="mb-8 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white">Risk Distribution</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Breakdown across all assessments
                </p>
              </div>

              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-500">
                {totalScans} scans
              </span>
            </div>

            <div className="space-y-4">
              {[
                ["Low", lowRisk, "bg-emerald-400"],
                ["Moderate", moderateRisk, "bg-yellow-400"],
                ["Medium", mediumRisk, "bg-orange-400"],
                ["High", highRisk, "bg-red-400"],
                ["Critical", criticalRisk, "bg-red-600"],
              ].map(([label, value, bar]) => {
                const count = Number(value);
                const percentage =
                  totalScans > 0
                    ? Math.round((count / totalScans) * 100)
                    : 0;

                return (
                  <div key={String(label)}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-sm text-slate-300">
                        {label}
                      </span>

                      <span className="text-xs text-slate-500">
                        {count} · {percentage}%
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div
                        className={`h-full rounded-full ${bar} transition-all duration-700`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="mb-5">
              <h3 className="font-bold text-white">Scan Type Analytics</h3>
              <p className="mt-1 text-xs text-slate-500">
                Activity and risk by security indicator type
              </p>
            </div>

            <div className="space-y-3">
              {scanTypeAnalytics.map((item) => {
                const active = typeFilter === item.type;

                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() =>
                      setTypeFilter(active ? "all" : item.type)
                    }
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-blue-400/40 bg-blue-400/10 shadow-lg shadow-blue-500/10"
                        : "border-white/5 bg-black/10 hover:border-blue-400/20 hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold uppercase ${
                          active
                            ? "bg-blue-400/20 text-blue-200"
                            : "bg-blue-400/10 text-blue-300"
                        }`}
                      >
                        {item.type.slice(0, 1)}
                      </span>

                      <div>
                        <p className="text-sm font-semibold uppercase text-slate-200">
                          {item.type}
                        </p>
                        <p className="text-[11px] text-slate-600">
                          {item.count} scan{item.count === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="text-xs text-slate-600">Avg Risk</p>
                        <p className="text-sm font-bold text-slate-300">
                          {item.avg}/100
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-600">High+</p>
                        <p className="text-sm font-bold text-red-400">
                          {item.highPlus}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Priority Threats */}
        {(highRisk + criticalRisk) > 0 && (
          <section className="mb-8 rounded-2xl border border-red-400/20 bg-red-400/[0.03] p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white">Priority Threats</h3>
                <p className="mt-1 text-xs text-slate-500">
                  High and critical security assessments requiring attention
                </p>
              </div>

              <button
                type="button"
                onClick={() => setRiskFilter("high")}
                className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-400/20"
              >
                View High Risk
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {history
                .filter((item) =>
                  ["high", "critical"].includes(item.risk_level.toLowerCase())
                )
                .slice(0, 4)
                .map((item) => (
                  <button
                    key={item.scan_id}
                    type="button"
                    onClick={() => openScanDetails(item.scan_id)}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-black/10 px-4 py-3 text-left transition hover:border-red-400/30 hover:bg-red-400/[0.04]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-400/10 text-sm">
                        {item.risk_level.toLowerCase() === "critical"
                          ? "🚨"
                          : "⚠️"}
                      </span>

                      <div>
                        <p className="text-sm font-semibold uppercase text-slate-200">
                          {item.scan_type}
                        </p>
                        <p className="mt-0.5 max-w-[180px] truncate text-[11px] text-slate-600">
                          {item.scan_id}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-bold text-red-300">
                        {item.risk_score}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-600">
                        {item.risk_level}
                      </p>
                    </div>
                  </button>
                ))}
            </div>
          </section>
        )}

        {/* Scan Panel */}
        <section className="glass overflow-hidden rounded-2xl">
          <div className="border-b border-white/10 px-5 pt-5">
            <div className="flex gap-2 overflow-x-auto pb-4">
              {scanTabs.map((tab) => {
                const active = scanType === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setScanType(tab.id);
                      setResult(null);
                      setError("");
                    }}
                    className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                        : "bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    <span className="mr-2">{tab.icon}</span>
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300">
                Security Indicator
              </label>

              {inputData && (
                <button
                  onClick={clearScan}
                  className="text-xs text-slate-500 transition hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            <textarea
              value={inputData}
              onChange={(e) => setInputData(e.target.value)}
              placeholder={
                scanType === "url"
                  ? "https://example.com"
                  : scanType === "ip"
                    ? "8.8.8.8"
                    : scanType === "hash"
                      ? "SHA-256 / SHA-1 / MD5 hash"
                      : scanType === "email"
                        ? "Paste the suspicious email content..."
                        : "Paste security logs for defensive analysis..."
              }
              rows={6}
              className="w-full resize-none rounded-xl border border-white/10 bg-[#080d18] px-4 py-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-400/50 focus:ring-2 focus:ring-blue-500/10"
            />

            {error && (
              <div className="mt-3 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">
                ⚠️ {error}
              </div>
            )}

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Defensive analysis only • No exploitation or intrusive
                scanning
              </p>

              <button
                onClick={startScan}
                disabled={loading}
                className="rounded-xl bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Analyzing...
                  </span>
                ) : (
                  "🔍 Start Security Scan"
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Loading */}
        {loading && (
          <section className="glass mt-6 rounded-2xl p-8">
            <div className="mx-auto max-w-2xl">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                    AI Security Engine
                  </p>
                  <h3 className="mt-2 text-xl font-bold text-white">
                    Running Security Analysis
                  </h3>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-300">
                    {scanProgress}%
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-600">
                    Progress
                  </p>
                </div>
              </div>

              <div className="mb-5 h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-blue-400 transition-all duration-500"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>

              <div className="mb-6 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-400/10">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400/20 border-t-blue-400" />
                </span>

                <div>
                  <p className="text-sm font-medium text-slate-200">
                    {scanStage}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Please wait while CyberGuard AI completes the assessment.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  "Validation",
                  "Threat Intel",
                  "Risk Engine",
                  "AI Analysis",
                ].map((stage, index) => {
                  const thresholds = [20, 45, 70, 90];
                  const complete = scanProgress >= thresholds[index];

                  return (
                    <div
                      key={stage}
                      className={`rounded-lg border px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider transition ${
                        complete
                          ? "border-blue-400/20 bg-blue-400/10 text-blue-300"
                          : "border-white/5 bg-white/[0.02] text-slate-600"
                      }`}
                    >
                      {complete ? "✓ " : ""}
                      {stage}
                    </div>
                  );
                })}
              </div>

              <p className="mt-5 text-center text-[10px] text-slate-600">
                Defensive analysis only • No exploitation or intrusive scanning
              </p>
            </div>
          </section>
        )}

        {/* Result */}
        {result && !loading && (
          <section className="mt-6 space-y-5">
            {/* Risk Summary */}
            <div className="glass rounded-2xl p-6">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Security Assessment
                  </p>

                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-2xl">
                      {getRiskIcon(result.risk_level)}
                    </span>

                    <h3
                      className={`text-2xl font-bold ${getRiskClass(
                        result.risk_level
                      )}`}
                    >
                      {result.risk_level} Risk
                    </h3>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <div
                    className={`text-4xl font-black ${getRiskClass(
                      result.risk_level
                    )}`}
                  >
                    {result.risk_score}
                    <span className="text-lg text-slate-600">/100</span>
                  </div>
                  <p className="text-xs text-slate-500">Risk Score</p>
                </div>
              </div>

              {/* Risk meter */}
              <div className="h-3 overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    result.risk_score <= 20
                      ? "bg-emerald-400"
                      : result.risk_score <= 40
                        ? "bg-yellow-400"
                        : result.risk_score <= 60
                          ? "bg-orange-400"
                          : "bg-red-500"
                  }`}
                  style={{
                    width: `${Math.max(result.risk_score, 3)}%`,
                  }}
                />
              </div>

              <div className="mt-2 flex justify-between text-[10px] text-slate-600">
                <span>LOW</span>
                <span>MODERATE</span>
                <span>MEDIUM</span>
                <span>HIGH</span>
                <span>CRITICAL</span>
              </div>
            </div>

            {/* VT */}
            <div className="glass rounded-2xl p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">
                    🛡️ Threat Intelligence
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    External reputation intelligence
                  </p>
                </div>

                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1 text-xs text-emerald-300">
                  {result.threat_intelligence?.status === "completed"
                    ? "Completed"
                    : result.threat_intelligence?.status || "Unavailable"}
                </span>
              </div>

              {stats ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <div className="rounded-xl border border-red-400/10 bg-red-400/5 p-4">
                    <p className="text-xs text-slate-500">Malicious</p>
                    <p className="mt-2 text-2xl font-bold text-red-400">
                      {stats.malicious ?? 0}
                    </p>
                  </div>

                  <div className="rounded-xl border border-yellow-400/10 bg-yellow-400/5 p-4">
                    <p className="text-xs text-slate-500">Suspicious</p>
                    <p className="mt-2 text-2xl font-bold text-yellow-400">
                      {stats.suspicious ?? 0}
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/5 p-4">
                    <p className="text-xs text-slate-500">Harmless</p>
                    <p className="mt-2 text-2xl font-bold text-emerald-400">
                      {stats.harmless ?? 0}
                    </p>
                  </div>

                  <div className="rounded-xl border border-blue-400/10 bg-blue-400/5 p-4">
                    <p className="text-xs text-slate-500">Undetected</p>
                    <p className="mt-2 text-2xl font-bold text-blue-400">
                      {stats.undetected ?? 0}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs text-slate-500">Timeout</p>
                    <p className="mt-2 text-2xl font-bold text-slate-300">
                      {stats.timeout ?? 0}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
                  {result.threat_intelligence?.message ||
                    "No threat intelligence statistics available."}
                </div>
              )}
            </div>

            {/* Findings + Recommendations */}
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="glass rounded-2xl p-6">
                <h3 className="mb-4 text-lg font-bold">
                  🔎 Security Findings
                </h3>

                <div className="space-y-3">
                  {result.findings.map((finding, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm leading-6 text-slate-300"
                    >
                      <span className="mr-2 text-blue-400">●</span>
                      {finding}
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass rounded-2xl p-6">
                <h3 className="mb-4 text-lg font-bold">
                  💡 Recommendations
                </h3>

                <div className="space-y-3">
                  {result.recommendations.map((recommendation, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm leading-6 text-slate-300"
                    >
                      <span className="mr-2 text-emerald-400">✓</span>
                      {recommendation}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Gemini */}
            <div className="glass rounded-2xl p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-xl">
                  🤖
                </div>

                <div>
                  <h3 className="text-lg font-bold">
                    AI Security Analysis
                  </h3>
                  <p className="text-xs text-slate-500">
                    Gemini-assisted defensive assessment
                  </p>
                </div>
              </div>

              {result.ai_analysis ? (
                <div className="markdown-report rounded-xl border border-white/10 bg-[#080d18] p-5">
                  <ReactMarkdown>{result.ai_analysis}</ReactMarkdown>
                </div>
              ) : (
                <div className="rounded-xl border border-yellow-400/10 bg-yellow-400/5 p-4 text-sm text-yellow-200">
                  AI analysis is currently unavailable for this scan.
                </div>
              )}
            </div>

            {/* Scan metadata */}
            <div className="glass rounded-2xl p-5">
              <div className="grid gap-4 text-xs sm:grid-cols-3">
                <div>
                  <p className="text-slate-600">Scan ID</p>
                  <p className="mt-1 break-all font-mono text-slate-400">
                    {result.scan_id}
                  </p>
                </div>

                <div>
                  <p className="text-slate-600">Scan Type</p>
                  <p className="mt-1 uppercase text-slate-400">
                    {result.scan_type}
                  </p>
                </div>

                <div>
                  <p className="text-slate-600">Status</p>
                  <p className="mt-1 text-emerald-400">
                    ● {result.status}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* History */}
        <section className="glass mt-8 overflow-hidden rounded-2xl">
          <div className="border-b border-white/10 px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Scan History</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Recent security assessments
                </p>
              </div>

              <button
                onClick={loadHistory}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:bg-white/5 hover:text-white"
              >
                Refresh
              </button>
            </div>
          </div>

          {history.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-6 py-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search scans..."
                className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-[#080d18] px-3 py-2 text-xs text-white outline-none placeholder:text-slate-600 focus:border-blue-400/40"
              />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-lg border border-white/10 bg-[#080d18] px-3 py-2 text-xs text-slate-300 outline-none"
              >
                <option value="all">All Types</option>
                <option value="url">URL</option>
                <option value="ip">IP</option>
                <option value="hash">Hash</option>
                <option value="email">Email</option>
                <option value="log">Log</option>
              </select>

              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="rounded-lg border border-white/10 bg-[#080d18] px-3 py-2 text-xs text-slate-300 outline-none"
              >
                <option value="all">All Risk Levels</option>
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          )}

          {history.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-600">
              No scans loaded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Risk</th>
                    <th className="px-6 py-4">Score</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Created</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredHistory.map((item) => (
                    <tr
                      key={item.scan_id}
                      onClick={() => openScanDetails(item.scan_id)}
                      className="cursor-pointer border-b border-white/5 transition hover:bg-blue-500/[0.05]"
                    >
                      <td className="px-6 py-4 font-medium text-slate-300">
                        {item.scan_type.toUpperCase()}
                      </td>

                      <td
                        className={`px-6 py-4 font-semibold ${getRiskClass(
                          item.risk_level
                        )}`}
                      >
                        {item.risk_level}
                      </td>

                      <td className="px-6 py-4 text-slate-400">
                        {item.risk_score}/100
                      </td>

                      <td className="px-6 py-4 text-emerald-400">
                        ● {item.status}
                      </td>

                      <td className="px-6 py-4 text-slate-600">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openScanDetails(item.scan_id);
                            }}
                            className="rounded-lg border border-blue-400/20 bg-blue-400/5 px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-400/10"
                          >
                            View
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteScan(item.scan_id);
                            }}
                            className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-400/10"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* System status */}
        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.03] p-4">
            <p className="text-xs text-slate-600">Backend API</p>
            <p className="mt-1 text-sm font-semibold text-emerald-400">
              ● Operational
            </p>
          </div>

          <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.03] p-4">
            <p className="text-xs text-slate-600">Database</p>
            <p className="mt-1 text-sm font-semibold text-emerald-400">
              ● PostgreSQL Healthy
            </p>
          </div>

          <div className="rounded-xl border border-blue-400/10 bg-blue-400/[0.03] p-4">
            <p className="text-xs text-slate-600">AI + Threat Intel</p>
            <p className="mt-1 text-sm font-semibold text-blue-400">
              ● Gemini + VirusTotal
            </p>
          </div>
        </section>

        <footer className="py-10 text-center text-xs text-slate-700">
          CyberGuard AI • Defensive cybersecurity analysis platform
        </footer>
      </div>

      {/* Scan Details Modal */}
      {(selectedScan || detailsLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => {
            if (!detailsLoading) setSelectedScan(null);
          }}
        >
          <div
            className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-white/10 bg-[#080d18] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {detailsLoading ? (
              <div className="p-16 text-center">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-400/20 border-t-blue-400" />
                <p className="text-sm text-slate-400">
                  Loading security assessment...
                </p>
              </div>
            ) : selectedScan ? (
              <>
                {/* Report Header */}
                <div className="sticky top-0 z-10 border-b border-white/10 bg-[#080d18]/95 px-6 py-5 backdrop-blur-xl">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-400/10 text-xl">
                        🛡️
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">
                          CyberGuard AI • Security Report
                        </p>
                        <h3 className="mt-1 text-xl font-bold text-white">
                          {selectedScan.scan_type.toUpperCase()} Threat Assessment
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          if (!selectedScan) return;
                          const token = getToken();
                          if (!token) {
                            window.location.href = "/login";
                            return;
                          }

                          try {
                            const response = await fetch(
                              `${API_URL}/api/v1/scans/${selectedScan.scan_id}/pdf`,
                              {
                                headers: {
                                  Authorization: `Bearer ${token}`,
                                },
                              }
                            );

                            if (!response.ok) {
                              throw new Error("PDF generation failed");
                            }

                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement("a");

                            link.href = url;
                            link.download = `cyberguard-security-report-${selectedScan.scan_id}.pdf`;
                            document.body.appendChild(link);
                            link.click();
                            link.remove();
                            window.URL.revokeObjectURL(url);
                          } catch (error) {
                            console.error(error);
                            alert("Unable to generate PDF report.");
                          }
                        }}
                        className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/20"
                      >
                        Export PDF
                      </button>

                      <button
                        onClick={() => setSelectedScan(null)}
                        className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-5 p-6">

                  {/* Executive Risk Summary */}
                  <section className="grid gap-4 lg:grid-cols-[1.15fr_1fr_1fr]">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Overall Risk
                          </p>
                          <p
                            className={`mt-2 text-5xl font-black ${getRiskClass(
                              selectedScan.risk_level
                            )}`}
                          >
                            {selectedScan.risk_score}
                            <span className="text-lg text-slate-600">/100</span>
                          </p>
                        </div>

                        <div className="text-right">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase ${getRiskClass(
                              selectedScan.risk_level
                            )}`}
                          >
                            {getRiskIcon(selectedScan.risk_level)}{" "}
                            {selectedScan.risk_level}
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-current transition-all"
                          style={{
                            width: `${Math.min(
                              Math.max(selectedScan.risk_score, 0),
                              100
                            )}%`,
                          }}
                        />
                      </div>

                      <p className="mt-3 text-xs leading-5 text-slate-500">
                        Deterministic defensive risk score based on available
                        security evidence and threat intelligence.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Assessment Status
                      </p>
                      <p className="mt-3 text-lg font-bold text-emerald-400">
                        ● {selectedScan.status}
                      </p>
                      <p className="mt-2 text-xs text-slate-600">
                        Security assessment completed successfully.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Analysis Engine
                      </p>
                      <p className="mt-3 text-lg font-bold text-blue-300">
                        Gemini + VirusTotal
                      </p>
                      <p className="mt-2 text-xs text-slate-600">
                        AI-assisted defensive analysis with threat intelligence.
                      </p>
                    </div>
                  </section>

                  {/* Target */}
                  <section className="rounded-2xl border border-white/10 bg-[#050a12] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                          Analyzed Indicator
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {selectedScan.scan_type.toUpperCase()}
                        </p>
                      </div>
                      <span className="rounded-lg border border-blue-400/10 bg-blue-400/5 px-2 py-1 text-[10px] uppercase tracking-wider text-blue-300">
                        Passive Analysis
                      </span>
                    </div>

                    <p className="mt-4 break-all rounded-xl border border-white/5 bg-black/20 p-4 font-mono text-sm leading-6 text-slate-300">
                      {selectedScan.input_data}
                    </p>
                  </section>

                  {/* Threat Intelligence */}
                  {selectedScan.threat_intelligence &&
                    Object.keys(selectedScan.threat_intelligence).length > 0 && (
                      <section className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.02] p-5">
                        <div className="mb-5 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400">
                              Threat Intelligence
                            </p>
                            <h4 className="mt-1 text-lg font-bold text-white">
                              VirusTotal Evidence
                            </h4>
                          </div>
                          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase text-cyan-300">
                            External Intel
                          </span>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {[
                            ["Malicious", "malicious", "text-red-400"],
                            ["Suspicious", "suspicious", "text-amber-400"],
                            ["Harmless", "harmless", "text-emerald-400"],
                            ["Undetected", "undetected", "text-slate-300"],
                          ].map(([label, key, color]) => {
                            const value =
                              selectedScan.threat_intelligence?.stats?.[
                                key as "malicious" | "suspicious" | "harmless" | "undetected"
                              ] ?? 0;

                            return (
                              <div
                                key={key}
                                className="rounded-xl border border-white/5 bg-black/20 p-4"
                              >
                                <p className="text-xs text-slate-500">{label}</p>
                                <p
                                  className={`mt-2 text-2xl font-black ${color}`}
                                >
                                  {String(value)}
                                </p>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-4 rounded-xl border border-white/5 bg-black/20 p-4">
                          <p className="text-xs text-slate-500">
                            Intelligence Status
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-200">
                            {String(
                              selectedScan.threat_intelligence?.status ??
                                "Available"
                            )}
                          </p>
                        </div>
                      </section>
                    )}

                  {/* Findings + Recommendations */}
                  <div className="grid gap-5 lg:grid-cols-2">
                    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-white">
                          🔎 Security Findings
                        </h4>
                        <span className="rounded-full bg-blue-400/10 px-2.5 py-1 text-[10px] font-bold text-blue-300">
                          {selectedScan.findings.length} findings
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {selectedScan.findings.length > 0 ? (
                          selectedScan.findings.map((finding, index) => (
                            <div
                              key={index}
                              className="rounded-xl border border-white/5 bg-black/20 p-4"
                            >
                              <div className="flex gap-3">
                                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-400/10 text-xs text-blue-300">
                                  {index + 1}
                                </span>
                                <p className="text-sm leading-6 text-slate-300">
                                  {finding}
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-600">
                            No security findings were recorded.
                          </p>
                        )}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-white">
                          💡 Recommended Actions
                        </h4>
                        <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                          Defensive
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {selectedScan.recommendations.length > 0 ? (
                          selectedScan.recommendations.map(
                            (recommendation, index) => (
                              <div
                                key={index}
                                className="rounded-xl border border-white/5 bg-black/20 p-4"
                              >
                                <div className="flex gap-3">
                                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-xs text-emerald-300">
                                    ✓
                                  </span>
                                  <p className="text-sm leading-6 text-slate-300">
                                    {recommendation}
                                  </p>
                                </div>
                              </div>
                            )
                          )
                        ) : (
                          <p className="text-sm text-slate-600">
                            No recommendations were recorded.
                          </p>
                        )}
                      </div>
                    </section>
                  </div>

                  {/* AI Analysis */}
                  {selectedScan.ai_analysis && (
                    <section className="rounded-2xl border border-purple-400/10 bg-purple-400/[0.025] p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-400">
                            AI Security Analysis
                          </p>
                          <h4 className="mt-1 text-lg font-bold text-white">
                            Gemini Assessment
                          </h4>
                        </div>
                        <span className="rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1 text-[10px] font-semibold uppercase text-purple-300">
                          AI Assisted
                        </span>
                      </div>

                      <div className="rounded-xl border border-white/5 bg-black/20 p-5">
                        <div className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
                          {selectedScan.ai_analysis}
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Report Metadata */}
                  <section className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Scan ID
                      </p>
                      <p className="mt-2 break-all font-mono text-xs text-slate-400">
                        {selectedScan.scan_id}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Created
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        {formatDate(selectedScan.created_at)}
                      </p>
                    </div>
                  </section>

                  <div className="border-t border-white/5 pt-4 text-center">
                    <p className="text-[10px] text-slate-600">
                      CyberGuard AI • Defensive cybersecurity analysis only •
                      No exploitation or intrusive scanning
                    </p>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

    </main>
  );
}
