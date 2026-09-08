'use client';

import { useState } from 'react';

const API_URL = 'http://localhost:8000';

const scanTypes = [
  { id: 'url', label: 'URL / Domain', icon: '🌐', placeholder: 'https://example.com' },
  { id: 'ip', label: 'IP Address', icon: '🔢', placeholder: '8.8.8.8' },
  { id: 'hash', label: 'File Hash', icon: '#️⃣', placeholder: 'SHA-256 hash' },
  { id: 'email', label: 'Phishing Email', icon: '📧', placeholder: 'Paste suspicious email content...' },
  { id: 'log', label: 'Security Log', icon: '📋', placeholder: 'Paste security log...' },
];

type ScanResult = {
  scan_id: string;
  scan_type: string;
  risk_score: number;
  risk_level: string;
  status: string;
  findings: string[];
  recommendations: string[];
};

export default function Home() {
  const [type, setType] = useState('url');
  const [input, setInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');

  const selected = scanTypes.find((item) => item.id === type)!;

  const handleScan = async () => {
    if (!input.trim()) return;

    setScanning(true);
    setResult(null);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/v1/scans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scan_type: type,
          input_data: input.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Scan request failed');
      }

      const data: ScanResult = await response.json();
      setResult(data);
    } catch {
      setError('Unable to connect to the security engine.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-8">

        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold">CyberGuard AI</h1>
            <p className="mt-1 text-slate-400">
              AI-powered defensive security analysis
            </p>
          </div>

          <div className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300">
            Security Platform
          </div>
        </header>

        <section className="py-12">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-cyan-400">
            Security Scanner
          </p>

          <h2 className="text-4xl font-bold">
            Analyze a potential threat
          </h2>

          <p className="mt-3 max-w-2xl text-slate-400">
            Submit a URL, IP address, file hash, suspicious email, or security
            log for defensive security analysis.
          </p>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">

            <div className="flex flex-wrap gap-2">
              {scanTypes.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setType(item.id);
                    setInput('');
                    setResult(null);
                    setError('');
                  }}
                  className={`rounded-lg px-4 py-3 text-sm font-medium transition ${
                    type === item.id
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </div>

            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium text-slate-300">
                {selected.label}
              </label>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={selected.placeholder}
                rows={type === 'url' || type === 'ip' || type === 'hash' ? 2 : 7}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-4 text-white outline-none placeholder:text-slate-600 focus:border-cyan-500"
              />
            </div>

            <div className="mt-5 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Passive and defensive analysis only.
              </p>

              <button
                onClick={handleScan}
                disabled={!input.trim() || scanning}
                className="rounded-lg bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {scanning ? 'Analyzing...' : 'Start Security Scan'}
              </button>
            </div>

            {error && (
              <div className="mt-5 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
                {error}
              </div>
            )}
          </div>
        </section>

        {result && (
          <section className="mb-10 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">Scan Result</p>
                <h3 className="mt-1 text-2xl font-bold">
                  {result.risk_level} Risk
                </h3>
              </div>

              <div className="text-right">
                <p className="text-sm text-slate-400">Risk Score</p>
                <p className="text-4xl font-bold text-cyan-400">
                  {result.risk_score}/100
                </p>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="font-semibold">Findings</h4>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-slate-300">
                {result.findings.map((finding, index) => (
                  <li key={index}>{finding}</li>
                ))}
              </ul>
            </div>

            <div className="mt-6">
              <h4 className="font-semibold">Recommendations</h4>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-slate-300">
                {result.recommendations.map((recommendation, index) => (
                  <li key={index}>{recommendation}</li>
                ))}
              </ul>
            </div>

            <p className="mt-6 text-xs text-slate-600">
              Scan ID: {result.scan_id}
            </p>
          </section>
        )}

        <section className="grid gap-5 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Backend API</p>
            <p className="mt-2 text-2xl font-semibold text-green-400">Online</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Database</p>
            <p className="mt-2 text-2xl font-semibold text-green-400">Connected</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">Security Engine</p>
            <p className="mt-2 text-2xl font-semibold text-cyan-400">Ready</p>
          </div>
        </section>

      </div>
    </main>
  );
}
