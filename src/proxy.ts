import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicAsset =
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".");

  if (isPublicAsset) {
    return NextResponse.next();
  }

  const publicPageRoutes = ["/login"];
  const publicApiRoutes = ["/api/auth/login", "/api/auth/verify-2fa-login"];
  const isPublicPageRoute = publicPageRoutes.some(
    (route) => pathname === route || pathname.startsWith(route)
  );
  const isPublicApiRoute = publicApiRoutes.some((route) => pathname === route);
  const token = request.cookies.get("access_token")?.value;

  if (pathname.startsWith("/api/")) {
    if (!isPublicApiRoute && !token) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required",
        },
        { status: 401 }
      );
    }

    return NextResponse.next();
  }

  if (pathname === "/") {
    const destination = token ? "/admin/dashboard" : "/login";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (!isPublicPageRoute && !token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login") {
    if (token) {
      const dashboardUrl = new URL("/admin/dashboard", request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images).*)"],
};
