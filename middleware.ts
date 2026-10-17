import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, isAdminCookieValid } from "@/lib/admin-session";

const adminNoStoreHeaders = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  Pragma: "no-cache",
  Expires: "0"
};

function preventAdminCaching(response: NextResponse) {
  Object.entries(adminNoStoreHeaders).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminPage = pathname.startsWith("/admin") && pathname !== "/admin/login";
  const isAdminApi =
    pathname.startsWith("/api/admin") && pathname !== "/api/admin/login" && pathname !== "/api/admin/logout";
  const isAdminRoute = isAdminPage || isAdminApi;

  if (!isAdminRoute) {
    return preventAdminCaching(NextResponse.next());
  }

  // Skip auth in local development so you can browse /admin without logging in.
  if (process.env.NODE_ENV !== "production") {
    return preventAdminCaching(NextResponse.next());
  }

  const isAdmin = await isAdminCookieValid(request.cookies.get(ADMIN_COOKIE_NAME)?.value);

  if (!isAdmin) {
    if (isAdminApi) {
      return preventAdminCaching(NextResponse.json({ error: "Admin access required." }, { status: 401 }));
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.searchParams.set("next", pathname);
    return preventAdminCaching(NextResponse.redirect(loginUrl));
  }

  return preventAdminCaching(NextResponse.next());
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"]
};
