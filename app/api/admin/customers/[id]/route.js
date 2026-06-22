import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import Customer from "@/models/Customer";
import crypto from "crypto";

function isAdmin(email) {
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").filter(Boolean);
  return adminEmails.includes(email);
}

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();
    const { action, notes, moneda } = body;

    if (!["approve", "reject", "resend", "set_moneda"].includes(action)) {
      return NextResponse.json(
        { error: "Acción no válida." },
        { status: 400 }
      );
    }

    await connectMongo();

    const customer = await Customer.findById(id);
    if (!customer) {
      return NextResponse.json(
        { error: "Cliente no encontrado." },
        { status: 404 }
      );
    }

    if (action === "set_moneda") {
      if (!["USD", "MXN"].includes(moneda)) {
        return NextResponse.json({ error: "Moneda inválida." }, { status: 400 });
      }
      customer.moneda = moneda;
      await customer.save();
      return NextResponse.json({ success: true, moneda: customer.moneda });
    }

    if (action === "approve" || action === "resend") {
      if (action === "approve") {
        customer.status = "approved";
        customer.approvedAt = new Date();
        customer.rejectedAt = undefined;
      }
      // Generate long-lived access token (30 days)
      const token = crypto.randomBytes(32).toString("hex");
      customer.loginToken = token;
      customer.loginTokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    } else {
      customer.status = "rejected";
      customer.rejectedAt = new Date();
      customer.approvedAt = undefined;
      customer.loginToken = null;
      customer.loginTokenExpiry = null;
    }

    if (notes !== undefined) {
      customer.notes = notes;
    }

    await customer.save();

    let accessUrl = null;
    let whatsappUrl = null;

    if (action === "approve" || action === "resend") {
      const baseUrl = process.env.NEXTAUTH_URL || "https://tienda.eqkor.mx";
      accessUrl = `${baseUrl}/acceso?token=${customer.loginToken}`;

      if (customer.whatsapp) {
        // Strip everything except digits
        const digits = customer.whatsapp.replace(/\D/g, "");
        const message = encodeURIComponent(
          `Hola ${customer.nombre}, tu acceso a EQKOR Tienda fue aprobado. Ingresa aquí: ${accessUrl}`
        );
        whatsappUrl = `https://wa.me/52${digits}?text=${message}`;
      }
    }

    return NextResponse.json({
      success: true,
      customer: customer.toJSON(),
      accessUrl,
      whatsappUrl,
    });
  } catch (error) {
    console.error("[api/admin/customers/[id]] Error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
