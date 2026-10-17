import { NextResponse } from "next/server";
import { z } from "zod";
import { invalidateGameContentCache } from "@/lib/supabase/game-content-cache";
import {
  clearRuntimeDatabaseConfig,
  getRuntimeDatabaseStatus,
  saveRuntimeDatabaseConfig,
  testRuntimeDatabaseCredentials,
  type RuntimeDatabaseCredentials
} from "@/lib/supabase/runtime-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const credentialsSchema = z.object({
  url: z.string().trim().url(),
  anonKey: z.string().trim().min(20),
  serviceRoleKey: z.string().trim().min(20)
});

function noStore<T>(payload: T, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: { "Cache-Control": "no-store, max-age=0", ...(init?.headers ?? {}) }
  });
}

export async function GET() {
  try {
    return noStore({ data: await getRuntimeDatabaseStatus() });
  } catch (error) {
    return noStore({ error: error instanceof Error ? error.message : "Unable to load database status." }, { status: 500 });
  }
}

async function parseCredentials(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = credentialsSchema.safeParse(body);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Enter a valid Supabase URL and keys.");
  return parsed.data as RuntimeDatabaseCredentials;
}

export async function POST(request: Request) {
  try {
    const credentials = await parseCredentials(request);
    return noStore({ data: await testRuntimeDatabaseCredentials(credentials) });
  } catch (error) {
    return noStore({ error: error instanceof Error ? error.message : "Unable to test the target database." }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const credentials = await parseCredentials(request);
    const test = await testRuntimeDatabaseCredentials(credentials);
    await saveRuntimeDatabaseConfig(credentials);
    invalidateGameContentCache();
    return noStore({ data: { status: await getRuntimeDatabaseStatus(), test } });
  } catch (error) {
    return noStore({ error: error instanceof Error ? error.message : "Unable to activate the target database." }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    await clearRuntimeDatabaseConfig();
    invalidateGameContentCache();
    return noStore({ data: await getRuntimeDatabaseStatus() });
  } catch (error) {
    return noStore({ error: error instanceof Error ? error.message : "Unable to revert the database target." }, { status: 400 });
  }
}
