import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect admin routes (but let client-side handle auth check)
  // Supabase stores sessions in localStorage, not cookies, so we can't check here
  if (pathname.startsWith("/admin") && pathname !== "/admin") {
    // Allow through - client-side will check auth and redirect if needed
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
