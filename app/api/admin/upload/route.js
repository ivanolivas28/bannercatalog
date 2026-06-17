import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { put } from "@vercel/blob";

const ALLOWED_TYPES = ["mx", "usa", "chn", "banner", "sourcing", "remate"];
const ALLOWED_EXTS  = [".xlsx", ".xls", ".csv", ".txt"];

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

  const pathname = `catalog/${type}${ext}`;

  try {
    const blob = await put(pathname, file, {
      access: "private",
      allowOverwrite: true,
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      uploadedAt: new Date(),
    });
  } catch (err) {
    console.error("[Upload]", err.message);
    return NextResponse.json({ error: "Error al subir el archivo." }, { status: 500 });
  }
}
