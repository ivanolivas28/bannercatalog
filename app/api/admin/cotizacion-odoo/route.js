import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { createOdooQuotation } from "@/libs/odoo";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { items, contacto } = await req.json();
    if (!items?.length) {
      return NextResponse.json({ error: "Sin productos" }, { status: 400 });
    }

    // Use provided contacto or fall back to admin user
    const contactoFinal = contacto || {
      nombre: "EQKOR",
      apellido: "Admin",
      empresa: "EQKOR",
      email: session.user.email || "",
      telefono: "",
    };

    const result = await createOdooQuotation({ contacto: contactoFinal, items });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[/api/admin/cotizacion-odoo]", err);
    return NextResponse.json({ error: err.message || "Error Odoo" }, { status: 500 });
  }
}
