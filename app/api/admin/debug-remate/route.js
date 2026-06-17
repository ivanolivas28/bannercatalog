import { NextResponse } from "next/server";
import { parsearRemate } from "@/libs/catalog-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const base = process.env.NEXTAUTH_URL || "https://tienda.eqkor.mx";
    const url = `${base}/api/admin/blob-proxy?file=remate.xlsx`;

    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: `blob-proxy HTTP ${res.status}` });

    const csv = await res.text();
    const lines = csv.trim().split("\n");

    const mapa = parsearRemate(csv);
    const entries = Array.from(mapa.entries()).slice(0, 10);

    return NextResponse.json({
      totalLineas: lines.length,
      linea0: lines[0],
      linea1: lines[1],
      linea2: lines[2],
      remateCount: mapa.size,
      primeros10: entries,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message });
  }
}
