import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";

const WAGO_BASE = "https://wagopro.com";
const CACHE = new Map(); // pn → { data, ts }
const TTL = 1000 * 60 * 30; // 30 min cache per PN

// Parse wagopro HTML response to extract stock and price
function parseWagoHTML(html, pn) {
  // Tables typically have: PN | Descripción | Stock | Precio
  const rows = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  let tr;
  while ((tr = trRegex.exec(html)) !== null) {
    const cells = [];
    let td;
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    while ((td = tdRe.exec(tr[1])) !== null) {
      // Strip HTML tags
      cells.push(td[1].replace(/<[^>]+>/g, "").trim());
    }
    if (cells.length >= 2) rows.push(cells);
  }

  // Find the row matching our PN
  const pnUp = pn.toUpperCase();
  for (const row of rows) {
    const rowText = row.join(" ").toUpperCase();
    if (rowText.includes(pnUp)) {
      // Try to extract price (contains $ or numbers with decimals) and stock (integer)
      let precio = null;
      let stock = null;
      for (const cell of row) {
        const clean = cell.replace(/[$,\s]/g, "");
        if (/^\d+\.\d{2}$/.test(clean) && !precio) precio = parseFloat(clean);
        else if (/^\d+$/.test(clean) && stock === null) stock = parseInt(clean);
      }
      return { pn, precio, stock, rawRow: row };
    }
  }
  return { pn, precio: null, stock: null, rawRow: null };
}

async function wagoLogin() {
  const res = await fetch(`${WAGO_BASE}/checklogin.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      username1: process.env.WAGO_USER,
      password1: process.env.WAGO_PASS,
      Submit: "LOGIN",
    }),
    redirect: "manual",
  });

  // Collect Set-Cookie headers
  const cookies = res.headers.getSetCookie?.() ?? [];
  if (!cookies.length) {
    // fallback for older Node
    const raw = res.headers.get("set-cookie") || "";
    if (raw) cookies.push(raw);
  }
  const cookieStr = cookies.map((c) => c.split(";")[0]).join("; ");
  if (!cookieStr) throw new Error("Login fallido — sin cookies de sesión");
  return cookieStr;
}

async function wagoSearch(pn, cookieStr) {
  const res = await fetch(`${WAGO_BASE}/search_wago_stock_f3.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieStr,
    },
    body: new URLSearchParams({ q: pn, search: "Buscar" }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} al buscar en wagopro`);
  return res.text();
}

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isApproved && !session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const pn = searchParams.get("pn")?.trim().toUpperCase();
    if (!pn) return NextResponse.json({ error: "Falta el parámetro pn" }, { status: 400 });

    // Serve from cache if fresh
    const cached = CACHE.get(pn);
    if (cached && Date.now() - cached.ts < TTL) {
      return NextResponse.json({ ...cached.data, cached: true });
    }

    if (!process.env.WAGO_USER || !process.env.WAGO_PASS) {
      return NextResponse.json({ error: "Credenciales WAGO no configuradas" }, { status: 503 });
    }

    const cookieStr = await wagoLogin();
    const html = await wagoSearch(pn, cookieStr);
    const data = parseWagoHTML(html, pn);

    CACHE.set(pn, { data, ts: Date.now() });
    return NextResponse.json({ ...data, cached: false });
  } catch (err) {
    console.error("[/api/wago/stock]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
