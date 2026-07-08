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
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  if (searchParams.get("action") !== "download") return NextResponse.json({ error: "acción inválida" }, { status: 400 });

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
  if (searchParams.get("action") !== "upload") return NextResponse.json({ error: "acción inválida" }, { status: 400 });

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file) return NextResponse.json({ error: "Sin archivo" }, { status: 400 });

    const text = await file.text();
    const parsed = JSON.parse(text);
    const count = Object.keys(parsed).length;

    await put(BLOB_KEY, JSON.stringify(parsed), { access: "private", allowOverwrite: true });
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
