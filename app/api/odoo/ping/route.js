import { NextResponse } from "next/server";
import { odooAuth, getMXNRate } from "@/libs/odoo";

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
    const { uid } = await odooAuth();

    let mxnRate = null;
    try {
      mxnRate = await getMXNRate();
    } catch (e) {
      mxnRate = { error: e.message };
    }

    return NextResponse.json({ ok: true, uid, checks, mxnRate });
  } catch (err) {
    // Also try raw XML-RPC to see exact response
    let rawResponse = null;
    try {
      const body = `<?xml version="1.0"?><methodCall><methodName>authenticate</methodName><params><param><value><string>${process.env.ODOO_DB}</string></value></param><param><value><string>${process.env.ODOO_USER}</string></value></param><param><value><string>${process.env.ODOO_PASSWORD}</string></value></param><param><value><struct></struct></value></param></params></methodCall>`;
      const res = await fetch(`${process.env.ODOO_URL}/xmlrpc/2/common`, {
        method: "POST",
        headers: { "Content-Type": "text/xml" },
        body,
      });
      rawResponse = await res.text();
    } catch (e) {
      rawResponse = e.message;
    }
    return NextResponse.json({ ok: false, error: err.message, checks, rawResponse });
  }
}
