import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { SESSION_CONFIG } from "@/lib/session-config";

const cookieName = "commons_session";

function redirectToLogin(request, clearCookie = false, reason = "") {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  if (reason) loginUrl.searchParams.set("reason", reason);
  const response = NextResponse.redirect(loginUrl);
  if (clearCookie) {
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}

export async function middleware(request) {
  const pathname = request.nextUrl.pathname;
  const protectedPath =
    pathname.startsWith("/security/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/ask" ||
    pathname.startsWith("/ask/") ||
    pathname === "/billing" ||
    pathname === "/profile/me" ||
    pathname === "/dashboard/subscription" ||
    pathname === "/settings/billing";
  if (!protectedPath) return NextResponse.next();
  const token = request.cookies.get("commons_session")?.value;
  if (!token) return redirectToLogin(request);

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) throw new Error("Invalid JWT secret.");
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
      issuer: "commons",
    });
    if (
      process.env.JWT_ISSUE_TIME_CHECK !== "false" &&
      (typeof payload.iat !== "number" ||
        Date.now() - payload.iat * 1000 > SESSION_CONFIG.inactivityMs)
    )
      return redirectToLogin(request, true, "expired");
    return NextResponse.next();
  } catch {
    return redirectToLogin(request, true);
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/feed/:path*",
    "/community/:path*",
    "/discover/:path*",
    "/people/:path*",
    "/settings/:path*",
    "/profile/me",
    "/ask",
    "/ask/:path*",
    "/billing",
    "/dashboard/subscription",
    "/security/:path*",
    "/admin",
    "/admin/:path*",
  ],
};