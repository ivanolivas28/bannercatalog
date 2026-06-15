import { NextResponse } from "next/server";
import { cargarCatalogo } from "@/libs/catalog-utils";
import { syncCatalogToOdoo } from "@/libs/odoo";
import connectMongo from "@/libs/mongoose";
import SyncLog from "@/models/SyncLog";

/**
 * POST /api/odoo/sync
 *
 * Manually triggers a full catalog → Odoo product sync.
 * Protected by:
 *   Authorization: Bearer <ODOO_SYNC_SECRET>   ← manual calls
 *   ?secret=<ODOO_SYNC_SECRET>                  ← Vercel Cron
 *
 * Required env vars:
 *   ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASSWORD — Odoo connection
 *   ODOO_SYNC_SECRET                             — Auth token
 */
export async function POST(req) {
  // ─── Auth ────────────────────────────────────────────────────────────────
  const secret = process.env.ODOO_SYNC_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "ODOO_SYNC_SECRET is not configured on the server." },
      { status: 503 }
    );
  }

  const authHeader = req.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const { searchParams } = new URL(req.url);
  const queryToken = searchParams.get("secret") || "";
  const token = bearerToken || queryToken;

  if (token !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // ─── Odoo check ──────────────────────────────────────────────────────────
  if (!process.env.ODOO_URL || !process.env.ODOO_DB) {
    return NextResponse.json(
      { error: "Odoo is not configured (ODOO_URL / ODOO_DB missing)." },
      { status: 503 }
    );
  }

  // ─── Load catalog ────────────────────────────────────────────────────────
  let productos;
  try {
    productos = await cargarCatalogo();
  } catch (err) {
    console.error("[Odoo Sync] Error loading catalog:", err.message);
    return NextResponse.json(
      { error: `Failed to load catalog: ${err.message}` },
      { status: 500 }
    );
  }

  if (!productos?.length) {
    return NextResponse.json({ error: "Catalog returned no products." }, { status: 500 });
  }

  console.log(`[Odoo Sync] Starting sync of ${productos.length} products…`);
  const startedAt = Date.now();

  // ─── Sync ────────────────────────────────────────────────────────────────
  let result;
  try {
    result = await syncCatalogToOdoo(productos);
  } catch (err) {
    console.error("[Odoo Sync] Unexpected error:", err.message);
    return NextResponse.json(
      { error: `Sync failed: ${err.message}` },
      { status: 500 }
    );
  }

  const duration = Date.now() - startedAt;
  const status = result.errors.length === 0
    ? "success"
    : result.synced > 0 ? "partial" : "error";

  console.log(`[Odoo Sync] Done — ${result.synced} synced, ${result.errors.length} errors (${duration}ms)`);

  // ─── Save log to MongoDB ─────────────────────────────────────────────────
  try {
    await connectMongo();
    await SyncLog.create({
      service: "odoo",
      status,
      synced: result.synced,
      total: productos.length,
      errors: result.errors.length,
      errorList: result.errors.slice(0, 20), // cap at 20 to avoid huge docs
      duration,
    });
  } catch (logErr) {
    console.error("[Odoo Sync] Failed to save sync log:", logErr.message);
  }

  return NextResponse.json({
    status,
    synced: result.synced,
    total: productos.length,
    errors: result.errors,
    duration,
  });
}

/**
 * GET /api/odoo/sync/status
 *
 * Returns the last 10 sync logs.
 * Protected by the same ODOO_SYNC_SECRET.
 */
export async function GET(req) {
  const secret = process.env.ODOO_SYNC_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "ODOO_SYNC_SECRET not configured." }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const { searchParams } = new URL(req.url);
  const queryToken = searchParams.get("secret") || "";
  const token = bearerToken || queryToken;

  if (token !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectMongo();
    const logs = await SyncLog.find({ service: "odoo" })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const last = logs[0] ?? null;

    return NextResponse.json({
      lastSync: last
        ? {
            at: last.createdAt,
            status: last.status,
            synced: last.synced,
            total: last.total,
            errors: last.errors,
            duration: last.duration,
          }
        : null,
      history: logs.map((l) => ({
        at: l.createdAt,
        status: l.status,
        synced: l.synced,
        total: l.total,
        errors: l.errors,
        duration: l.duration,
      })),
    });
  } catch (err) {
    console.error("[Odoo Sync Status]", err.message);
    return NextResponse.json({ error: "Failed to fetch sync logs." }, { status: 500 });
  }
}
