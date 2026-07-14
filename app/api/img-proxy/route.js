import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED_HOSTS = ["www.wago.com", "wago.com", "cdn.bannersolutions.com", "images.bannersolutions.com"];

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) return new NextResponse("Missing url", { status: 400 });

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return new NextResponse("Host not allowed", { status: 403 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; eqkor-catalog/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return new NextResponse("Fetch failed", { status: 502 });

    const buf = await res.arrayBuffer();
    const ct = res.headers.get("content-type") || "image/jpeg";

    return new NextResponse(buf, {
      headers: {
        "Content-Type": ct,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    return new NextResponse(err.message, { status: 502 });
  }
}
