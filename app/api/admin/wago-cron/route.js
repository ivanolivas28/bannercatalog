import { NextResponse } from "next/server";
import { ensureAuth, callKw } from "@/libs/odoo";
import { put, list } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 55;

const WAGO_BASE = "https://wagopro.com";
const BATCH_SIZE = 20;
const DELAY_MS = 400;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wagoLogin() {
  const res = await fetch(`${WAGO_BASE}/checklogin.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username1: process.env.WAGO_USER, password1: process.env.WAGO_PASS, Submit: "LOGIN" }),
    redirect: "manual",
  });
  const cookies = res.headers.getSetCookie?.() ?? [];
  if (!cookies.length) { const raw = res.headers.get("set-cookie") || ""; if (raw) cookies.push(raw); }
  const cookieStr = cookies.map((c) => c.split(";")[0]).join("; ");
  if (!cookieStr) throw new Error("Login wagopro fallido");
  return cookieStr;
}

async function wagoSearch(pn, cookieStr) {
  const res = await fetch(`${WAGO_BASE}/search_wago_stock_f3.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookieStr },
    body: new URLSearchParams({ q: pn, search: "Buscar" }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseWagoHTML(html, pn) {
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = [];
  let tr;
  while ((tr = trRegex.exec(html)) !== null) {
    const cells = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let td;
    while ((td = tdRe.exec(tr[1])) !== null) cells.push(td[1].replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/&reg;/g,"®").replace(/&trade;/g,"™").replace(/&nbsp;/g," ").replace(/&#\d+;/g,"").trim());
    if (cells.length >= 6) rows.push(cells);
  }
  // Columnas: [PN, Descripción, Precio lista, Precio OEM/neto, Pzas Mínimas, Stock]
  // (verificado 2026-08-17 — row[4] es "Pzas Mínimas", no stock)
  const pnUp = pn.toUpperCase();
  for (const row of rows) {
    if (row[0]?.trim().toUpperCase() !== pnUp) continue;
    const p = (s) => parseFloat((s || "").replace(/[$,\s]/g, "")) || null;
    const s = (s) => parseInt((s || "").replace(/[^\d]/g, "")) || 0;
    return { pn, desc: row[1]?.trim() || "", precioNeto: p(row[3]), stock: s(row[5]) };
  }
  return { pn, desc: "", precioNeto: null, stock: null };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  const offset = parseInt(searchParams.get("offset") || "0");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    await ensureAuth();

    const categories = await callKw({
      model: "product.category",
      method: "search_read",
      args: [[["complete_name", "ilike", "wago"]]],
      kwargs: { fields: ["id"], limit: 200 },
    });
    const catIds = categories.map((c) => c.id);

    const products = await callKw({
      model: "product.template",
      method: "search_read",
      args: [[["categ_id", "in", catIds], ["active", "=", true]]],
      kwargs: { fields: ["id", "name", "default_code", "categ_id"], limit: 500 },
    });

    const batch = products.slice(offset, offset + BATCH_SIZE);
    const nextOffset = offset + BATCH_SIZE < products.length ? offset + BATCH_SIZE : null;

    // Fire next batch BEFORE processing so it runs in parallel with our work
    const base = process.env.NEXTAUTH_URL || "https://tienda.eqkor.mx";
    if (nextOffset !== null) {
      fetch(`${base}/api/admin/wago-cron?secret=${process.env.CRON_SECRET}&offset=${nextOffset}`)
        .catch(() => {}); // fire and forget
    }

    // Load existing blob first so we can preserve manually added fields
    const BLOB_KEY = "catalog/wago-stock.json";
    let existing = {};
    try {
      const { blobs } = await list({ prefix: BLOB_KEY });
      const existingBlob = blobs.find((b) => b.pathname === BLOB_KEY);
      if (existingBlob) {
        const r = await fetch(existingBlob.url, { headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` } });
        if (r.ok) existing = await r.json();
      }
    } catch (_) {}

    const cookieStr = await wagoLogin();
    let updated = 0, notFound = 0;
    const blobResults = {};

    for (const prod of batch) {
      const pn = (prod.default_code || "").trim();
      if (!pn) continue;
      await sleep(DELAY_MS);
      try {
        const html = await wagoSearch(pn, cookieStr);
        const wago = parseWagoHTML(html, pn);
        const catName = Array.isArray(prod.categ_id) ? prod.categ_id[1] : "WAGO";
        if (wago.precioNeto !== null) {
          const precioVenta = +(wago.precioNeto / 0.80).toFixed(4);
          await callKw({ model: "product.template", method: "write", args: [[prod.id], { standard_price: wago.precioNeto, list_price: precioVenta }], kwargs: {} });
          blobResults[pn] = { ...(existing[pn] || {}), stock: wago.stock ?? 0, precioNeto: wago.precioNeto, precioVenta, desc: wago.desc || prod.name, categoria: catName, ts: Date.now() };
          updated++;
        } else if (wago.desc) {
          // Producto encontrado en wagopro pero sin precio (stock 0) — guardarlo igual para que aparezca en tienda
          blobResults[pn] = { ...(existing[pn] || {}), stock: 0, precioNeto: null, precioVenta: existing[pn]?.precioVenta || 0, desc: wago.desc || prod.name, categoria: catName, ts: Date.now() };
          notFound++;
        } else { notFound++; }
      } catch (_) { notFound++; }
    }

    // Merge into wago-stock.json in Blob
    try {
      Object.assign(existing, blobResults);
      await put(BLOB_KEY, JSON.stringify(existing), { access: "private", allowOverwrite: true });
    } catch (blobErr) {
      console.warn("[wago-cron] blob save failed:", blobErr.message);
    }

    console.log(`[wago-cron] offset=${offset} updated=${updated} notFound=${notFound} nextOffset=${nextOffset}`);
    return NextResponse.json({ offset, updated, notFound, nextOffset, done: nextOffset === null });
  } catch (err) {
    console.error("[wago-cron]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
