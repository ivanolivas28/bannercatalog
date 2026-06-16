import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Customer from "@/models/Customer";
import { sendEmail } from "@/libs/mailgun";
import config from "@/config";

const FREE_EMAIL_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "hotmail.es",
  "yahoo.com",
  "yahoo.com.mx",
  "outlook.com",
  "outlook.es",
  "live.com",
  "live.com.mx",
  "icloud.com",
  "me.com",
  "aol.com",
  "protonmail.com",
  "mail.com",
];

function isFreeEmail(email) {
  if (!email) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  return FREE_EMAIL_DOMAINS.includes(domain);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { nombre, apellido, empresa, email, whatsapp } = body;

    // Validate required base fields
    if (!nombre || !apellido || !empresa) {
      return NextResponse.json(
        { error: "Nombre, apellido y empresa son obligatorios." },
        { status: 400 }
      );
    }

    // Require at least one contact method
    if (!email && !whatsapp) {
      return NextResponse.json(
        {
          error:
            "Proporciona al menos un correo corporativo o número de WhatsApp.",
        },
        { status: 400 }
      );
    }

    // Validate email if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: "El formato del correo no es válido." },
          { status: 400 }
        );
      }
      if (isFreeEmail(email)) {
        return NextResponse.json(
          {
            error:
              "Usa tu correo corporativo. No se aceptan correos de Gmail, Hotmail, Yahoo, Outlook ni similares.",
          },
          { status: 400 }
        );
      }
    }

    await connectMongo();

    // Check for duplicate email (if provided)
    if (email) {
      const existingByEmail = await Customer.findOne({
        email: email.toLowerCase(),
      });
      if (existingByEmail) {
        if (existingByEmail.status === "pending") {
          return NextResponse.json(
            {
              error:
                "Ya existe una solicitud con este correo. Estamos revisando tu registro.",
            },
            { status: 409 }
          );
        } else if (existingByEmail.status === "approved") {
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
    }

    // Check for duplicate whatsapp (if provided and no email)
    if (whatsapp && !email) {
      const existingByWa = await Customer.findOne({ whatsapp });
      if (existingByWa) {
        if (existingByWa.status === "pending") {
          return NextResponse.json(
            {
              error:
                "Ya existe una solicitud con este número de WhatsApp. Estamos revisando tu registro.",
            },
            { status: 409 }
          );
        } else if (existingByWa.status === "approved") {
          return NextResponse.json(
            {
              error:
                "Este número de WhatsApp ya está registrado y aprobado. Contáctanos para acceder.",
            },
            { status: 409 }
          );
        } else {
          return NextResponse.json(
            {
              error:
                "Este número ya fue registrado anteriormente. Contáctanos para más información.",
            },
            { status: 409 }
          );
        }
      }
    }

    // Create customer — only set email/whatsapp if provided
    const customerData = {
      nombre,
      apellido,
      empresa,
      status: "pending",
    };
    if (email) customerData.email = email.toLowerCase();
    if (whatsapp) customerData.whatsapp = whatsapp;

    const customer = await Customer.create(customerData);

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
          ${
            email
              ? `<tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px; font-weight: bold;">Correo</td>
            <td style="padding: 8px;">${email}</td>
          </tr>`
              : ""
          }
          ${
            whatsapp
              ? `<tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 8px; font-weight: bold;">WhatsApp</td>
            <td style="padding: 8px;">${whatsapp}</td>
          </tr>`
              : ""
          }
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
        text: `Nueva solicitud de acceso.\n\nNombre: ${nombre} ${apellido}\nEmpresa: ${empresa}${email ? `\nCorreo: ${email}` : ""}${whatsapp ? `\nWhatsApp: ${whatsapp}` : ""}\n\nRevisar en: ${adminUrl}`,
        html: emailHtml,
      });
    } else {
      console.log(
        "[registro] MAILGUN_API_KEY not set. Admin notification skipped."
      );
      console.log("[registro] New customer:", {
        nombre,
        apellido,
        empresa,
        email,
        whatsapp,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/registro] Error:", error);
    // Surface Mongoose validation errors to the user
    if (error.name === "ValidationError") {
      const msg = Object.values(error.errors)
        .map((e) => e.message)
        .join(" ");
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Error interno. Intenta de nuevo más tarde." },
      { status: 500 }
    );
  }
}
