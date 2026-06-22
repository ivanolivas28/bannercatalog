import { NextResponse } from "next/server";
import { getMXNRate } from "@/libs/odoo";

export const dynamic = "force-dynamic";

let _cache = null;
let _cacheAt = 0;
const TTL = 6 * 60 * 60 * 1000; // 6 hours

export async function GET() {
  try {
    const now = Date.now();
    if (_cache && now - _cacheAt < TTL) {
      return NextResponse.json(_cache);
    }
    const { mxnPerUsd, usdData } = await getMXNRate();
    if (!mxnPerUsd) throw new Error("No se pudo obtener el tipo de cambio");
    _cache = { mxnPerUsd, date: usdData?.date || null };
    _cacheAt = now;
    return NextResponse.json(_cache);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
