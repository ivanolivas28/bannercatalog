import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { getMXNRate } from "@/libs/odoo";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { mxnPerUsd } = await getMXNRate();
    if (!mxnPerUsd) {
      return NextResponse.json({ error: "No se pudo obtener tipo de cambio de Odoo" }, { status: 500 });
    }

    return NextResponse.json({ tipoCambioOdoo: mxnPerUsd, tipoCambioSugerido: +(mxnPerUsd + 1).toFixed(2) });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
