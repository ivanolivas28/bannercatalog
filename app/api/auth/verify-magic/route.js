import { NextResponse } from "next/server";

// This route is deprecated. Token verification now happens at /acceso.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  return NextResponse.redirect(
    new URL(`/acceso?token=${encodeURIComponent(token)}`, req.url)
  );
}
