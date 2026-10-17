"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Database, Eye, EyeOff, RefreshCcw, ShieldCheck, TestTube2 } from "lucide-react";
import { toast } from "sonner";
import {
  activateRuntimeDatabase,
  fetchRuntimeDatabaseStatus,
  revertRuntimeDatabase,
  testRuntimeDatabase,
  type RuntimeDatabaseStatus,
  type RuntimeDatabaseTestResult
} from "@/lib/admin-client";

type FormState = { url: string; anonKey: string; serviceRoleKey: string };
const emptyForm: FormState = { url: "", anonKey: "", serviceRoleKey: "" };

function host(value: string | null) {
  if (!value) return "Not configured";
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

export default function AdminDatabasePage() {
  const [status, setStatus] = useState<RuntimeDatabaseStatus | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [testResult, setTestResult] = useState<RuntimeDatabaseTestResult | null>(null);
  const [showServiceKey, setShowServiceKey] = useState(false);
  const [busy, setBusy] = useState<"load" | "test" | "activate" | "revert" | null>("load");
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    setBusy("load");
    try {
      setStatus(await fetchRuntimeDatabaseStatus());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load database status.");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function testTarget() {
    setBusy("test");
    try {
      const result = await testRuntimeDatabase(form);
      setTestResult(result);
      setError(null);
      toast.success(`Connected to ${result.host}`);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Target connection failed.");
      setTestResult(null);
    } finally {
      setBusy(null);
    }
  }

  async function activateTarget() {
    if (!window.confirm("Activate this Supabase project for all new requests? The master project remains available for revert.")) return;
    setBusy("activate");
    try {
      const result = await activateRuntimeDatabase(form);
      setStatus(result.status);
      setTestResult(result.test);
      setError(null);
      toast.success("Supabase target activated live");
    } catch (activateError) {
      setError(activateError instanceof Error ? activateError.message : "Unable to activate target.");
    } finally {
      setBusy(null);
    }
  }

  async function revertTarget() {
    if (!window.confirm("Revert the app to the master Supabase project?")) return;
    setBusy("revert");
    try {
      setStatus(await revertRuntimeDatabase());
      setError(null);
      toast.success("Reverted to master Supabase");
    } catch (revertError) {
      setError(revertError instanceof Error ? revertError.message : "Unable to revert target.");
    } finally {
      setBusy(null);
    }
  }

  const isBusy = busy !== null;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-black/45">Infrastructure</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl font-black tracking-tight">Database rotation</h1>
            <p className="mt-2 max-w-3xl text-sm font-bold text-black/55">
              Keep the Vercel-configured Supabase project as the encrypted master, then test and switch the live target without redeploying.
            </p>
          </div>
          <button type="button" onClick={() => void loadStatus()} disabled={isBusy} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-xs font-black uppercase disabled:opacity-50">
            <RefreshCcw className={`h-4 w-4 ${busy === "load" ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["Master project", status ? host(status.masterUrl) : "Loading…", status?.masterConfigured ? "Ready" : "Missing env"],
          ["Active project", status ? host(status.activeUrl) : "Loading…", status?.source === "runtime" ? "Rotated target" : "Master"],
          ["Encryption", status?.encryptionConfigured ? "Configured" : "Missing", status?.encryptionConfigured ? "AES-256-GCM" : "Set DATABASE_CONFIG_ENCRYPTION_KEY"]
        ].map(([label, value, detail]) => (
          <div key={label} className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-black/45">{label}</p>
            <p className="mt-2 truncate text-lg font-black">{value}</p>
            <p className="mt-1 text-xs font-bold text-black/45">{detail}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black text-white"><Database className="h-5 w-5" /></div>
          <div>
            <h2 className="text-xl font-black">Test or activate a target</h2>
            <p className="mt-1 text-sm font-bold text-black/50">The service-role key is encrypted before storage and is never returned to the browser.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold md:col-span-2">Supabase project URL<input value={form.url} onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://your-project.supabase.co" className="h-11 rounded-xl border border-black/15 px-3 font-medium outline-none focus:border-black" /></label>
          <label className="grid gap-1 text-sm font-bold">Anon/public key<input value={form.anonKey} onChange={(event) => setForm((current) => ({ ...current, anonKey: event.target.value }))} type="password" className="h-11 rounded-xl border border-black/15 px-3 font-medium outline-none focus:border-black" /></label>
          <label className="grid gap-1 text-sm font-bold">Service-role key<div className="flex h-11 overflow-hidden rounded-xl border border-black/15"><input value={form.serviceRoleKey} onChange={(event) => setForm((current) => ({ ...current, serviceRoleKey: event.target.value }))} type={showServiceKey ? "text" : "password"} className="min-w-0 flex-1 px-3 font-medium outline-none" /><button type="button" onClick={() => setShowServiceKey((current) => !current)} className="grid w-11 place-items-center border-l border-black/10" aria-label={showServiceKey ? "Hide service key" : "Show service key"}>{showServiceKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => void testTarget()} disabled={isBusy || !form.url || !form.anonKey || !form.serviceRoleKey} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-black/15 bg-white px-4 text-sm font-black uppercase disabled:opacity-40"><TestTube2 className="h-4 w-4" /> {busy === "test" ? "Testing…" : "Test connection"}</button>
          <button type="button" onClick={() => void activateTarget()} disabled={isBusy || !testResult} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-black px-4 text-sm font-black uppercase text-white disabled:opacity-40"><CheckCircle2 className="h-4 w-4" /> {busy === "activate" ? "Activating…" : "Activate target"}</button>
          <button type="button" onClick={() => void revertTarget()} disabled={isBusy || status?.source !== "runtime"} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-black uppercase text-red-700 disabled:opacity-40">Revert to master</button>
        </div>
        {testResult ? <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-black/[0.04] px-4 py-3 text-sm font-bold"><span>Connected: {testResult.host}</span><span>Players {testResult.counts.players}</span><span>Categories {testResult.counts.categories}</span><span>Config rows {testResult.counts.gameConfig}</span></div> : null}
      </section>

      <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5" /><div><h2 className="text-xl font-black">Before switching</h2><p className="mt-1 text-sm font-bold text-black/50">Apply this project’s migrations to the target first, then test it here. Every server request resolves the active target with a short cache so a switch becomes live quickly.</p></div></div>
      </section>

      <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-black/45">Migration guide</p>
        <h2 className="mt-1 text-2xl font-black">Move data with pgAdmin Desktop</h2>
        <ol className="mt-4 grid gap-3 text-sm font-bold text-black/65 md:grid-cols-2">
          <li><span className="mr-2 text-black">1.</span>Create the target Supabase project and run this repo’s SQL migrations (or restore the app schema first).</li>
          <li><span className="mr-2 text-black">2.</span>In Supabase Dashboard → Connect, copy the Session pooler PostgreSQL settings. Use port 5432 in pgAdmin.</li>
          <li><span className="mr-2 text-black">3.</span>Register both servers in pgAdmin. Use the database password, username `postgres`, and the downloaded Supabase SSL root certificate.</li>
          <li><span className="mr-2 text-black">4.</span>On the source server, right-click the database → Backup. Choose Custom format and include the `public` schema/app data.</li>
          <li><span className="mr-2 text-black">5.</span>On the target server, right-click the database → Restore. Select the backup, enable “no owner” and “no privileges”, then run it.</li>
          <li><span className="mr-2 text-black">6.</span>Apply any migrations added after the backup, verify players/categories/config, then Test connection above before activating.</li>
        </ol>
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900">Do not blindly overwrite Supabase-managed auth, storage, or Vault schemas. Move app tables and storage objects deliberately; Auth users and Vault secrets have project-specific handling.</p>
      </section>
    </div>
  );
}
