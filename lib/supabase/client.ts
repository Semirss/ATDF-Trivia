"use client";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

let browserClient: SupabaseClient<Database> | null | undefined;
let browserClientPromise: Promise<SupabaseClient<Database> | null> | null = null;
let browserConfigKey = "";
let browserConfigCheckedAt = 0;
const BROWSER_CONFIG_TTL_MS = 5_000;

async function fetchRuntimeConfig() {
  const response = await fetch("/api/game/runtime-database", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load the game database configuration.");
  return (await response.json()) as { url?: string; anonKey?: string };
}

export async function createBrowserSupabaseClient() {
  if (browserClientPromise) return browserClientPromise;

  if (browserClient !== undefined && Date.now() - browserConfigCheckedAt < BROWSER_CONFIG_TTL_MS) {
    return browserClient;
  }

  browserClientPromise = fetchRuntimeConfig()
    .catch(() => ({
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    }))
    .then(async ({ url, anonKey }) => {
      if (!url || !anonKey) {
        browserClient = null;
        browserConfigKey = "";
        browserConfigCheckedAt = Date.now();
        return null;
      }

      const nextKey = `${url}|${anonKey}`;
      if (browserClient && browserConfigKey === nextKey) {
        browserConfigCheckedAt = Date.now();
        return browserClient;
      }

      if (browserClient) await browserClient.removeAllChannels();
      browserClient = createClient<Database>(url, anonKey, {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false
        },
        realtime: {
          params: { eventsPerSecond: 10 }
        }
      });
      browserConfigKey = nextKey;
      browserConfigCheckedAt = Date.now();
      return browserClient;
    });

  try {
    return await browserClientPromise;
  } finally {
    browserClientPromise = null;
  }
}

export function resetBrowserSupabaseClient() {
  browserClient = undefined;
  browserClientPromise = null;
  browserConfigKey = "";
  browserConfigCheckedAt = 0;
}
