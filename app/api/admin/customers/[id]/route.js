import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import Customer from "@/models/Customer";
import { sendEmail } from "@/libs/mailgun";

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
    const { action, notes } = body;

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Acción no válida. Usa 'approve' o 'reject'." },
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

    if (action === "approve") {
      customer.status = "approved";
      customer.approvedAt = new Date();
      customer.rejectedAt = undefined;
    } else {
      customer.status = "rejected";
      customer.rejectedAt = new Date();
      customer.approvedAt = undefined;
    }

    if (notes !== undefined) {
      customer.notes = notes;
    }

    await customer.save();

    // Send approval email to customer
    if (action === "approve") {
      const catalogUrl = `${process.env.NEXTAUTH_URL || "https://tienda.eqkor.mx"}/`;
      const companyName = process.env.NEXT_PUBLIC_APP_NAME || "MVP Industrial";

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #222;">
          <div style="background-color: #0f2028; padding: 32px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">¡Tu acceso ha sido aprobado!</h1>
          </div>
          <div style="padding: 32px; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; margin-top: 0;">
              Hola <strong>${customer.nombre}</strong>,
            </p>
            <p style="font-size: 15px; line-height: 1.6;">
              Nos da gusto informarte que tu solicitud de acceso al catálogo industrial de
              <strong>${companyName}</strong> ha sido <strong style="color: #16a34a;">aprobada</strong>.
            </p>
            <p style="font-size: 15px; line-height: 1.6;">
              Ya tienes acceso completo a nuestro catálogo con:
            </p>
            <ul style="font-size: 15px; line-height: 1.8;">
              <li>Precios actualizados</li>
              <li>Tiempos de entrega</li>
              <li>Stock disponible en México y USA</li>
            </ul>
            <p style="font-size: 15px; line-height: 1.6;">
              Para acceder, inicia sesión con tu correo en nuestra tienda:
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a
                href="${catalogUrl}"
                style="display: inline-block; background-color: #1c84be; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;"
              >
                Ir al catálogo
              </a>
            </div>
            <p style="font-size: 13px; color: #6b7280;">
              Inicia sesión con tu correo <strong>${customer.email}</strong> en nuestra tienda.
              Si tienes alguna duda, responde a este correo y con gusto te ayudamos.
            </p>
          </div>
        </div>
      `;

      const textBody = `Hola ${customer.nombre},\n\nTu solicitud de acceso al catálogo industrial ha sido aprobada.\n\nYa puedes ingresar al catálogo completo con precios y tiempos de entrega en: ${catalogUrl}\n\nInicia sesión con tu correo (${customer.email}) en nuestra tienda.\n\nSaludos,\n${companyName}`;

      if (process.env.MAILGUN_API_KEY) {
        await sendEmail({
          to: customer.email,
          subject: `¡Tu acceso ha sido aprobado! — ${companyName}`,
          text: textBody,
          html: htmlBody,
        });
      } else {
        console.log(
          "[admin/customers] MAILGUN_API_KEY not set. Approval email skipped for:",
          customer.email
        );
      }
    }

    return NextResponse.json({ success: true, customer: customer.toJSON() });
  } catch (error) {
    console.error("[api/admin/customers/[id]] Error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
