import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";

const ALLOWED_TYPES = ["mx", "usa", "chn", "banner", "sourcing", "remate"];
const ALLOWED_EXTS  = [".xlsx", ".xls", ".csv", ".txt"];

const CPANEL_UPLOAD_URL = "https://eqkor.mx/catalog-data/upload.php";

async function uploadToCpanel(type, file) {
  const fd = new FormData();
  fd.append("secret", process.env.CPANEL_UPLOAD_SECRET || "");
  fd.append("type", type);
  fd.append("file", file);
  const res = await fetch(CPANEL_UPLOAD_URL, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`cPanel HTTP ${res.status}`);
  return res.json();
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  const type = formData.get("type");

  if (!file || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const originalName = file.name.toLowerCase();
  const ext = ALLOWED_EXTS.find((e) => originalName.endsWith(e));
  if (!ext) {
    return NextResponse.json(
      { error: "Solo se permiten archivos .xlsx, .xls, .csv o .txt" },
      { status: 400 }
    );
  }

  const errors = [];

  // Intentar subir a cPanel
  try {
    await uploadToCpanel(type, file);
  } catch (err) {
    console.error("[Upload cPanel]", err.message);
    errors.push(`cPanel: ${err.message}`);
  }

  // Intentar subir a Vercel Blob (si está disponible)
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put } = await import("@vercel/blob");
      await put(`catalog/${type}${ext}`, file, { access: "private", allowOverwrite: true });
    } catch (err) {
      console.error("[Upload Blob]", err.message);
      errors.push(`Blob: ${err.message}`);
    }
  }

  // Si cPanel funcionó (primer intento) o al menos uno funcionó
  if (errors.length === 0 || (errors.length === 1 && errors[0].startsWith("Blob:"))) {
    return NextResponse.json({ ok: true, uploadedAt: new Date() });
  }

  return NextResponse.json({ error: errors.join(" | ") }, { status: 500 });
}
