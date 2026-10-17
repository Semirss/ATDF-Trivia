"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";

function AdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/admin";
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessCode })
    });

    setIsLoading(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? "Unable to enter admin.");
      return;
    }

    router.push(next);
  }

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-md rounded-lg border border-black/10 bg-white p-6 shadow-sm">
        <div className="grid h-14 w-14 place-items-center rounded-md bg-black text-white">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="mt-5 font-display text-3xl font-black">Admin Login</h1>
        <p className="mt-2 text-sm font-bold text-black/55">
          Enter the dashboard access code from `ADMIN_ACCESS_CODE` to manage live Supabase content.
        </p>
        <form onSubmit={login} className="mt-6 space-y-3">
          <input
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            className="min-h-12 w-full rounded-md border border-black/10 bg-black/[0.03] px-4 text-sm font-bold outline-none focus:border-black"
            placeholder="Admin access code"
            type="password"
          />
          {error ? <p className="text-sm font-bold text-red-500">{error}</p> : null}
          <button
            type="submit"
            disabled={isLoading}
            className="min-h-12 w-full rounded-md bg-black px-4 text-sm font-black uppercase text-white disabled:opacity-60"
          >
            {isLoading ? "Checking..." : "Enter Dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center font-black">Loading admin...</div>}>
      <AdminLoginContent />
    </Suspense>
  );
}
