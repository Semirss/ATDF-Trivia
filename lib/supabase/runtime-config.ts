import "server-only";

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type RuntimeDatabaseCredentials = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

export type RuntimeDatabaseStatus = {
  source: "master" | "runtime";
  activeUrl: string | null;
  masterUrl: string | null;
  updatedAt: string | null;
  masterConfigured: boolean;
  encryptionConfigured: boolean;
  serviceRoleConfigured: boolean;
};

type RuntimeConfigRow = {
  encrypted_payload: string;
  updated_at: string;
};

const CACHE_TTL_MS = 5_000;
let resolvedCache: { config: RuntimeDatabaseCredentials; source: "master" | "runtime"; updatedAt: string | null; expiresAt: number } | null = null;

function masterCredentials(): RuntimeDatabaseCredentials {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ""
  };
}

function encryptionKey() {
  const raw = process.env.DATABASE_CONFIG_ENCRYPTION_KEY?.trim();
  return raw ? crypto.createHash("sha256").update(raw).digest() : null;
}

function validateCredentials(credentials: RuntimeDatabaseCredentials) {
  if (!credentials.url || !/^https:\/\//i.test(credentials.url)) {
    throw new Error("Supabase URL must be an HTTPS project URL.");
  }
  if (!credentials.anonKey || !credentials.serviceRoleKey) {
    throw new Error("Both the anon key and service-role key are required.");
  }
}

function encode(buffer: Buffer) {
  return buffer.toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url");
}

function encryptCredentials(credentials: RuntimeDatabaseCredentials) {
  const key = encryptionKey();
  if (!key) throw new Error("DATABASE_CONFIG_ENCRYPTION_KEY is not configured on the server.");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);
  return `v1.${encode(iv)}.${encode(cipher.getAuthTag())}.${encode(encrypted)}`;
}

function decryptCredentials(payload: string): RuntimeDatabaseCredentials {
  const key = encryptionKey();
  if (!key) throw new Error("DATABASE_CONFIG_ENCRYPTION_KEY is not configured on the server.");
  const [version, ivPart, tagPart, dataPart] = payload.split(".");
  if (version !== "v1" || !ivPart || !tagPart || !dataPart) throw new Error("Invalid runtime database payload.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, decode(ivPart));
  decipher.setAuthTag(decode(tagPart));
  const plaintext = Buffer.concat([decipher.update(decode(dataPart)), decipher.final()]).toString("utf8");
  const credentials = JSON.parse(plaintext) as RuntimeDatabaseCredentials;
  validateCredentials(credentials);
  return credentials;
}

export function createMasterSupabaseClient() {
  const credentials = masterCredentials();
  if (!credentials.url || !credentials.serviceRoleKey) return null;
  return createClient<Database>(credentials.url, credentials.serviceRoleKey, {
    auth: { persistSession: false }
  });
}

export async function getResolvedDatabaseConfig() {
  const now = Date.now();
  if (resolvedCache && resolvedCache.expiresAt > now) return resolvedCache;

  const master = masterCredentials();
  let result: typeof resolvedCache;
  const masterClient = createMasterSupabaseClient();
  if (!masterClient || !master.url || !master.serviceRoleKey || !encryptionKey()) {
    result = { config: master, source: "master", updatedAt: null, expiresAt: now + CACHE_TTL_MS };
    resolvedCache = result;
    return result;
  }

  const { data, error } = await masterClient
    .from("runtime_database_config")
    .select("encrypted_payload, updated_at")
    .eq("slot", "active")
    .maybeSingle<RuntimeConfigRow>();

  if (error || !data) {
    result = { config: master, source: "master", updatedAt: null, expiresAt: now + CACHE_TTL_MS };
  } else {
    try {
      result = { config: decryptCredentials(data.encrypted_payload), source: "runtime", updatedAt: data.updated_at, expiresAt: now + CACHE_TTL_MS };
    } catch {
      result = { config: master, source: "master", updatedAt: null, expiresAt: now + CACHE_TTL_MS };
    }
  }
  resolvedCache = result;
  return result;
}

export function clearRuntimeConfigCache() {
  resolvedCache = null;
}

export async function getRuntimeDatabaseStatus(): Promise<RuntimeDatabaseStatus> {
  const master = masterCredentials();
  const resolved = await getResolvedDatabaseConfig();
  return {
    source: resolved.source,
    activeUrl: resolved.config.url || null,
    masterUrl: master.url || null,
    updatedAt: resolved.updatedAt,
    masterConfigured: Boolean(master.url && master.anonKey && master.serviceRoleKey),
    encryptionConfigured: Boolean(encryptionKey()),
    serviceRoleConfigured: Boolean(resolved.config.serviceRoleKey)
  };
}

export type RuntimeDatabaseTestResult = {
  host: string;
  counts: { players: number; categories: number; gameConfig: number };
};

export async function testRuntimeDatabaseCredentials(credentials: RuntimeDatabaseCredentials): Promise<RuntimeDatabaseTestResult> {
  validateCredentials(credentials);
  const client = createClient<Database>(credentials.url, credentials.serviceRoleKey, { auth: { persistSession: false } });
  const [players, categories, gameConfig] = await Promise.all([
    client.from("players").select("id", { count: "exact", head: true }),
    client.from("categories").select("id", { count: "exact", head: true }),
    client.from("game_config").select("id", { count: "exact", head: true })
  ]);
  const firstError = [players.error, categories.error, gameConfig.error].find(Boolean);
  if (firstError) throw new Error(firstError.message);
  return {
    host: new URL(credentials.url).host,
    counts: {
      players: players.count ?? 0,
      categories: categories.count ?? 0,
      gameConfig: gameConfig.count ?? 0
    }
  };
}

export async function saveRuntimeDatabaseConfig(credentials: RuntimeDatabaseCredentials) {
  validateCredentials(credentials);
  const client = createMasterSupabaseClient();
  if (!client) throw new Error("Master Supabase credentials are not configured.");
  const { error } = await client.from("runtime_database_config").upsert({
    slot: "active",
    encrypted_payload: encryptCredentials(credentials),
    updated_at: new Date().toISOString()
  });
  if (error) throw new Error(error.message);
  clearRuntimeConfigCache();
}

export async function clearRuntimeDatabaseConfig() {
  const client = createMasterSupabaseClient();
  if (!client) throw new Error("Master Supabase credentials are not configured.");
  const { error } = await client.from("runtime_database_config").delete().eq("slot", "active");
  if (error) throw new Error(error.message);
  clearRuntimeConfigCache();
}

export async function getRuntimePublicConfig() {
  const resolved = await getResolvedDatabaseConfig();
  return { url: resolved.config.url, anonKey: resolved.config.anonKey };
}
