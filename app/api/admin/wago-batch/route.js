import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { ensureAuth, callKw } from "@/libs/odoo";

export const dynamic = "force-dynamic";
export const maxDuration = 55; // under Vercel 60s limit

const WAGO_BASE = "https://wagopro.com";
const DELAY_MS = 400;
const BATCH_SIZE = 20;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const cookies = res.headers.getSetCookie?.() ?? [];
  if (!cookies.length) {
    const raw = res.headers.get("set-cookie") || "";
    if (raw) cookies.push(raw);
  }
  const cookieStr = cookies.map((c) => c.split(";")[0]).join("; ");
  if (!cookieStr) throw new Error("Login wagopro fallido");
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
    while ((td = tdRe.exec(tr[1])) !== null) {
      cells.push(td[1].replace(/<[^>]+>/g, "").replace(/&amp;/g,"&").replace(/&reg;/g,"®").replace(/&trade;/g,"™").replace(/&nbsp;/g," ").replace(/&#\d+;/g,"").trim());
    }
    if (cells.length >= 6) rows.push(cells);
  }
  // Columnas: [PN, Descripción, Precio lista, Precio OEM/neto, Pzas Mínimas, Stock]
  // (verificado 2026-08-17 — row[4] es "Pzas Mínimas", no stock)
  const pnUp = pn.toUpperCase();
  for (const row of rows) {
    if (row[0]?.trim().toUpperCase() !== pnUp) continue;
    const parsePrice = (s) => parseFloat((s || "").replace(/[$,\s]/g, "")) || null;
    const parseStock = (s) => parseInt((s || "").replace(/[^\d]/g, "")) || 0;
    return {
      pn,
      desc: row[1]?.trim() || "",
      precioLista: parsePrice(row[2]),
      precioNeto: parsePrice(row[3]),
      pzasMinimas: parseStock(row[4]),
      stock: parseStock(row[5]),
    };
  }
  return { pn, desc: "", precioLista: null, precioNeto: null, stock: null };
}

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dryRun = searchParams.get("dry") === "1";
    const offset = parseInt(searchParams.get("offset") || "0");
    const limit  = parseInt(searchParams.get("limit")  || String(BATCH_SIZE));

    // 1. Get all WAGO products from Odoo (category path includes "wago")
    await ensureAuth();

    // Find category IDs that contain "wago" in their complete path
    const categories = await callKw({
      model: "product.category",
      method: "search_read",
      args: [[["complete_name", "ilike", "wago"]]],
      kwargs: { fields: ["id", "name", "complete_name"], limit: 200 },
    });

    if (!categories?.length) {
      return NextResponse.json({ error: "No se encontraron categorías WAGO en Odoo", categories });
    }

    const catIds = categories.map((c) => c.id);

    // Get products in those categories
    const products = await callKw({
      model: "product.template",
      method: "search_read",
      args: [[["categ_id", "in", catIds], ["active", "=", true]]],
      kwargs: {
        fields: ["id", "name", "default_code", "list_price", "categ_id", "standard_price"],
        limit: 500,
      },
    });

    if (!products?.length) {
      return NextResponse.json({
        error: "No se encontraron productos WAGO en Odoo",
        categorias: categories.map((c) => c.complete_name),
      });
    }

    // Paginate the product list
    const totalProductos = products.length;
    const batch = products.slice(offset, offset + limit);
    const nextOffset = offset + limit < totalProductos ? offset + limit : null;

    if (dryRun) {
      return NextResponse.json({
        message: "DRY RUN — no se actualizó nada",
        categorias: categories.map((c) => c.complete_name),
        totalProductos,
        offset, limit, nextOffset,
        muestra: batch.slice(0, 10).map((p) => ({
          id: p.id, ref: p.default_code, nombre: p.name, precio: p.list_price,
        })),
      });
    }

    // 2. Login to wagopro
    const cookieStr = await wagoLogin();

    // 3. Process this batch
    const results = { updated: [], notFound: [], errors: [] };

    for (const prod of batch) {
      const pn = (prod.default_code || "").trim();
      if (!pn) { results.errors.push({ id: prod.id, nombre: prod.name, error: "Sin referencia interna" }); continue; }

      await sleep(DELAY_MS);

      try {
        const html = await wagoSearch(pn, cookieStr);
        const wago = parseWagoHTML(html, pn);

        if (wago.precioNeto === null && wago.stock === null) {
          results.notFound.push({ pn, nombre: prod.name });
          continue;
        }

        // Update Odoo: standard_price = costo wagopro, list_price = costo / 0.80
        const vals = {};
        if (wago.precioNeto !== null) {
          vals.standard_price = wago.precioNeto;
          vals.list_price = +(wago.precioNeto / 0.80).toFixed(4);
        }

        if (Object.keys(vals).length) {
          await callKw({
            model: "product.template",
            method: "write",
            args: [[prod.id], vals],
            kwargs: {},
          });
        }

        const catName = Array.isArray(prod.categ_id) ? prod.categ_id[1] : (prod.categ_id?.name || "WAGO");
        results.updated.push({
          pn,
          nombre: wago.desc || prod.name,
          categoria: catName,
          stockWago: wago.stock ?? 0,
          precioNeto: wago.precioNeto,
          precioVenta: wago.precioNeto !== null ? +(wago.precioNeto / 0.80).toFixed(4) : null,
        });
      } catch (err) {
        results.errors.push({ pn, nombre: prod.name, error: err.message });
      }
    }

    return NextResponse.json({
      totalProductos,
      offset,
      limit,
      nextOffset,
      nextUrl: nextOffset !== null ? `/api/admin/wago-batch?offset=${nextOffset}&limit=${limit}` : null,
      done: nextOffset === null,
      updated: results.updated.length,
      notFound: results.notFound.length,
      errors: results.errors.length,
      items: results.updated,
    });
  } catch (err) {
    console.error("[/api/admin/wago-batch]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
