import { NextResponse } from "next/server";
import { download } from "@vercel/blob";

const ALLOWED = ["mx.csv", "usa.csv", "chn.csv", "banner.csv", "sourcing.csv",
                 "mx.xlsx", "usa.xlsx", "chn.xlsx", "banner.xlsx", "sourcing.xlsx",
                 "mx.txt", "banner.txt", "sourcing.txt"];

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get("file");

  if (!file || !ALLOWED.includes(file)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const blob = await download(`catalog/${file}`);
    const text = await blob.text();
    return new NextResponse(text, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    return new NextResponse(`Blob error: ${err.message}`, { status: 500 });
  }
}
