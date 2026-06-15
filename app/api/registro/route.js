import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Customer from "@/models/Customer";
import { sendEmail } from "@/libs/mailgun";
import config from "@/config";

export async function POST(req) {
  try {
    const body = await req.json();
    const { nombre, apellido, empresa, email, whatsapp } = body;

    // Validate required fields
    if (!nombre || !apellido || !empresa || !email || !whatsapp) {
      return NextResponse.json(
        { error: "Todos los campos son obligatorios." },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "El formato del correo no es válido." },
        { status: 400 }
      );
    }

    await connectMongo();

    // Check for duplicate email
    const existing = await Customer.findOne({ email: email.toLowerCase() });
    if (existing) {
      if (existing.status === "pending") {
        return NextResponse.json(
          {
            error:
              "Ya existe una solicitud con este correo. Estamos revisando tu registro.",
          },
          { status: 409 }
        );
      } else if (existing.status === "approved") {
        return NextResponse.json(
          {
            error:
              "Este correo ya está registrado y aprobado. Inicia sesión directamente.",
          },
          { status: 409 }
        );
      } else {
        return NextResponse.json(
          {
            error:
              "Este correo ya fue registrado anteriormente. Contáctanos para más información.",
          },
          { status: 409 }
        );
      }
    }

    // Create customer
    const customer = await Customer.create({
      nombre,
      apellido,
      empresa,
      email,
      whatsapp,
      status: "pending",
    });

    // Send notification email to admin
    const adminUrl = `${process.env.NEXTAUTH_URL || "https://tienda.eqkor.mx"}/admin/clientes`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1c84be;">Nueva solicitud de acceso al catálogo</h2>
        <p>Un nuevo usuario ha solicitado acceso al catálogo industrial.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px; font-weight: bold; width: 140px;">Nombre</td>
            <td style="padding: 8px;">${nombre} ${apellido}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px; font-weight: bold;">Empresa</td>
            <td style="padding: 8px;">${empresa}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px; font-weight: bold;">Correo</td>
            <td style="padding: 8px;">${email}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px; font-weight: bold;">WhatsApp</td>
            <td style="padding: 8px;">${whatsapp}</td>
          </tr>
        </table>
        <a href="${adminUrl}" style="display: inline-block; background-color: #1c84be; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Revisar solicitud
        </a>
      </div>
    `;

    if (process.env.MAILGUN_API_KEY) {
      await sendEmail({
        to: config.mailgun.supportEmail,
        subject: `Nueva solicitud de acceso — ${nombre} ${apellido} (${empresa})`,
        text: `Nueva solicitud de acceso.\n\nNombre: ${nombre} ${apellido}\nEmpresa: ${empresa}\nCorreo: ${email}\nWhatsApp: ${whatsapp}\n\nRevisar en: ${adminUrl}`,
        html: emailHtml,
      });
    } else {
      console.log("[registro] MAILGUN_API_KEY not set. Admin notification skipped.");
      console.log("[registro] New customer:", { nombre, apellido, empresa, email, whatsapp });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/registro] Error:", error);
    return NextResponse.json(
      { error: "Error interno. Intenta de nuevo más tarde." },
      { status: 500 }
    );
  }
}
