import { NextResponse } from "next/server";
import { head } from "@vercel/blob";
import * as XLSX from "xlsx";

const ALLOWED = [
  "mx.csv", "usa.csv", "chn.csv",
  "banner.xlsx", "sourcing.xlsx",
  "banner.csv", "sourcing.csv",
  "mx.xlsx", "usa.xlsx", "chn.xlsx",
  "banner.txt", "sourcing.txt", "mx.txt",
];

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get("file");

  if (!file || !ALLOWED.includes(file)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    // Get the blob metadata (includes downloadUrl) using head()
    const metadata = await head(`catalog/${file}`);

    // Fetch the actual content using the signed downloadUrl
    const res = await fetch(metadata.downloadUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    if (file.endsWith(".xlsx") || file.endsWith(".xls")) {
      const arrayBuffer = await res.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      return new NextResponse(csv, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const text = await res.text();
    return new NextResponse(text, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    return new NextResponse(`Blob error: ${err.message}`, { status: 500 });
  }
}
