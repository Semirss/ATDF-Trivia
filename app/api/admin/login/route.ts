import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, createAdminCookieValue, getAdminAccessCode, LOCAL_ADMIN_COOKIE_VALUE } from "@/lib/admin-session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { accessCode?: string };
  const configuredCode = getAdminAccessCode();
  const submittedCode = body.accessCode?.trim() ?? "";

  if (configuredCode && submittedCode !== configuredCode) {
    return NextResponse.json({ error: "Invalid admin access code." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, configuredCode ? await createAdminCookieValue(configuredCode) : LOCAL_ADMIN_COOKIE_VALUE, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  return response;
}
