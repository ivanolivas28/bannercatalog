import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import Cotizacion from "@/models/Cotizacion";

function isAdmin(session) {
  if (!session?.user?.email) return false;
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").filter(Boolean);
  return adminEmails.includes(session.user.email) || session.user.isAdmin;
}

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!isAdmin(session)) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const { id } = params;

    await connectMongo();

    const cotizacion = await Cotizacion.findById(id);
    if (!cotizacion) {
      return NextResponse.json(
        { error: "Cotización no encontrada." },
        { status: 404 }
      );
    }

    if (cotizacion.status === "sent_to_odoo") {
      return NextResponse.json(
        { error: "Esta cotización ya fue enviada a Odoo." },
        { status: 409 }
      );
    }

    if (!process.env.ODOO_URL || !process.env.ODOO_DB) {
      return NextResponse.json(
        { error: "Odoo no está configurado en este entorno." },
        { status: 503 }
      );
    }

    const { createOdooQuotation } = await import("@/libs/odoo");

    // Build contacto object from cotizacion data
    const [nombre, ...apellidoParts] = (cotizacion.customerName || "").split(" ");
    const contacto = {
      nombre: nombre || cotizacion.customerName,
      apellido: apellidoParts.join(" ") || "",
      empresa: cotizacion.customerEmpresa || "",
      email: cotizacion.customerEmail || "",
      telefono: cotizacion.customerWhatsapp || "",
    };

    const result = await createOdooQuotation({
      contacto,
      items: cotizacion.items,
    });

    cotizacion.status = "sent_to_odoo";
    cotizacion.odooQuotationId = result.id;
    cotizacion.odooQuotationName = result.name;
    await cotizacion.save();

    return NextResponse.json({
      success: true,
      odooQuotationId: result.id,
      odooQuotationName: result.name,
    });
  } catch (error) {
    console.error("[api/admin/cotizaciones/[id]/odoo]", error);
    return NextResponse.json(
      { error: `Error al crear cotización en Odoo: ${error.message}` },
      { status: 500 }
    );
  }
}
