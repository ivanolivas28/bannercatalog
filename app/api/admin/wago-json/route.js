import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { put, list } from "@vercel/blob";

export const dynamic = "force-dynamic";

const BLOB_KEY = "catalog/wago-stock.json";

async function getExisting() {
  const { blobs } = await list({ prefix: BLOB_KEY });
  const b = blobs.find((x) => x.pathname === BLOB_KEY);
  if (!b) return {};
  const r = await fetch(b.url, { headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` } });
  return r.ok ? r.json() : {};
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  // /api/admin/wago-json?action=pns — public CORS endpoint, returns only PN list
  if (action === "pns") {
    const data = await getExisting();
    return new NextResponse(JSON.stringify(Object.keys(data)), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "https://www.wago.com",
        "Cache-Control": "no-store",
      },
    });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (action !== "download") return NextResponse.json({ error: "acción inválida" }, { status: 400 });

  const data = await getExisting();
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="wago-stock.json"',
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    if (action === "upload") {
      // Full replace
      const formData = await req.formData();
      const file = formData.get("file");
      if (!file) return NextResponse.json({ error: "Sin archivo" }, { status: 400 });
      const parsed = JSON.parse(await file.text());
      await put(BLOB_KEY, JSON.stringify(parsed), { access: "private", allowOverwrite: true });
      return NextResponse.json({ ok: true, count: Object.keys(parsed).length });
    }

    if (action === "enrich") {
      // Merge only imagen/spu fields from enrichment file
      const formData = await req.formData();
      const file = formData.get("file");
      if (!file) return NextResponse.json({ error: "Sin archivo" }, { status: 400 });
      const enrichment = JSON.parse(await file.text()); // { PN: { imagen, spu } }
      const existing = await getExisting();
      let enriched = 0;
      for (const [pn, data] of Object.entries(enrichment)) {
        if (!existing[pn]) existing[pn] = {};
        if (data.imagen) { existing[pn].imagen = data.imagen; enriched++; }
        if (data.spu)    { existing[pn].spu = data.spu; }
      }
      await put(BLOB_KEY, JSON.stringify(existing), { access: "private", allowOverwrite: true });
      return NextResponse.json({ ok: true, enriched, total: Object.keys(enrichment).length });
    }

    return NextResponse.json({ error: "acción inválida" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
