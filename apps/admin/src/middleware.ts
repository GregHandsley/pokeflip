import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { trackResponseTime } from "@/lib/monitoring/response-time";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Track response times for API routes
  if (pathname.startsWith("/api")) {
    const response = NextResponse.next();
    return trackResponseTime(req, response);
  }

  // Only protect admin routes (but let client-side handle auth check)
  // Supabase stores sessions in localStorage, not cookies, so we can't check here
  if (pathname.startsWith("/admin") && pathname !== "/admin") {
    // Allow through - client-side will check auth and redirect if needed
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
