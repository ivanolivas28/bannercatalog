import { NextResponse } from "next/server";
import { odooAuth } from "@/libs/odoo";

export async function GET() {
  const checks = {
    ODOO_URL: process.env.ODOO_URL || null,
    ODOO_DB: process.env.ODOO_DB || null,
    ODOO_USER: process.env.ODOO_USER || null,
    ODOO_PASSWORD: process.env.ODOO_PASSWORD ? "✓ set" : null,
  };

  const missing = Object.entries(checks)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    return NextResponse.json({ ok: false, error: "Missing env vars", missing, checks });
  }

  try {
    const session = await odooAuth();
    return NextResponse.json({ ok: true, uid: session.uid, checks });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message, checks });
  }
}
