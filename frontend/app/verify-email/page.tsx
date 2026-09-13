"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { API_URL } from "../lib-auth";

function VerifyEmailContent() {
  const params = useSearchParams();
  const router = useRouter();

  const [message, setMessage] = useState(
    "Check your inbox for a verification link."
  );
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const token = params.get("token");
    const emailParam = params.get("email");

    if (emailParam) {
      setEmail(emailParam);
    }

    if (!token || !emailParam) {
      return;
    }

    const verificationToken = token;
    const verificationEmail = emailParam;

    async function verify() {
      try {
        const response = await fetch(
          `${API_URL}/api/v1/auth/verify-email?token=${encodeURIComponent(
            verificationToken
          )}&email=${encodeURIComponent(verificationEmail)}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.detail || "Email verification failed."
          );
        }

        setMessage(
          data.message || "Email verified successfully."
        );

        setTimeout(() => {
          router.push("/login");
        }, 1500);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Email verification failed."
        );
      }
    }

    verify();
  }, [params, router]);

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
        <div className="text-5xl mb-5">🛡️</div>

        <h1 className="text-2xl font-bold">
          CyberGuard AI
        </h1>

        {error ? (
          <>
            <p className="mt-4 text-red-300">{error}</p>

            <button
              onClick={() => router.push("/login")}
              className="mt-6 w-full rounded-lg bg-blue-500 py-3 font-semibold text-white"
            >
              Go to Sign In
            </button>
          </>
        ) : (
          <>
            <p className="mt-4 text-slate-300">
              {message}
            </p>

            {!params.get("token") && (
              <button
                onClick={() =>
                  router.push(
                    email
                      ? `/signup?email=${encodeURIComponent(email)}`
                      : "/signup"
                  )
                }
                className="mt-6 w-full rounded-lg bg-blue-500 py-3 font-semibold text-white"
              >
                Create / Verify Account
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 flex items-center justify-center px-6 text-white">
          <div className="text-center">
            <div className="text-5xl mb-5">🛡️</div>
            <p className="text-slate-300">
              Loading verification...
            </p>
          </div>
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
