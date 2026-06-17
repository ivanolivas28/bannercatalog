import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import connectMongo from "@/libs/mongoose";
import Cotizacion from "@/models/Cotizacion";
import config from "@/config";

function fmtUSD(n) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildEmailHTML({ contacto, items }) {
  const subtotal = items.reduce(
    (s, i) => s + (i.precioUSD > 0 ? i.qty * i.precioUSD : 0),
    0
  );
  const iva   = subtotal * 0.16;
  const total = subtotal + iva;

  const rows = items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 10px;text-align:center;font-weight:bold;">${i.qty}</td>
        <td style="padding:8px 10px;font-family:monospace;font-size:13px;">${i.pn}</td>
        <td style="padding:8px 10px;font-size:13px;">${i.desc || i.pn}</td>
        <td style="padding:8px 10px;text-align:center;">${i.marca || ""}</td>
        <td style="padding:8px 10px;text-align:right;">
          ${i.precioUSD > 0 ? `$${fmtUSD(i.precioUSD)}` : "<em>Cotizar</em>"}
        </td>
        <td style="padding:8px 10px;text-align:right;font-weight:bold;">
          ${i.precioUSD > 0 ? `$${fmtUSD(i.qty * i.precioUSD)}` : "—"}
        </td>
      </tr>`
    )
    .join("");

  const totalesHTML =
    subtotal > 0
      ? `
      <tr><td colspan="5" style="padding:6px 10px;text-align:right;">Subtotal USD:</td>
          <td style="padding:6px 10px;text-align:right;">$${fmtUSD(subtotal)}</td></tr>
      <tr><td colspan="5" style="padding:6px 10px;text-align:right;">IVA 16%:</td>
          <td style="padding:6px 10px;text-align:right;">$${fmtUSD(iva)}</td></tr>
      <tr style="background:#f0f0f0;font-weight:bold;">
          <td colspan="5" style="padding:8px 10px;text-align:right;">TOTAL USD:</td>
          <td style="padding:8px 10px;text-align:right;">$${fmtUSD(total)}</td></tr>`
      : "";

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Solicitud de cotización</title></head>
<body style="font-family:Arial,sans-serif;color:#1d1e22;background:#f4f4f2;padding:20px;">
  <div style="max-width:700px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

    <!-- Header -->
    <div style="background:#0f2028;color:#fff;padding:24px 28px;">
      <h1 style="margin:0;font-size:20px;">Nueva solicitud de cotización</h1>
      <p style="margin:6px 0 0;opacity:.7;font-size:13px;">${new Date().toLocaleString("es-MX", { dateStyle: "full", timeStyle: "short" })}</p>
    </div>

    <!-- Customer info -->
    <div style="padding:24px 28px;border-bottom:1px solid #eaeae8;">
      <h2 style="margin:0 0 12px;font-size:15px;color:#1c84be;text-transform:uppercase;letter-spacing:1px;">Datos del cliente</h2>
      <table style="border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:3px 16px 3px 0;color:#666;width:90px;">Nombre</td>
            <td style="padding:3px 0;font-weight:bold;">${contacto.nombre} ${contacto.apellido}</td></tr>
        <tr><td style="padding:3px 16px 3px 0;color:#666;">Empresa</td>
            <td style="padding:3px 0;font-weight:bold;">${contacto.empresa}</td></tr>
        <tr><td style="padding:3px 16px 3px 0;color:#666;">Correo</td>
            <td style="padding:3px 0;"><a href="mailto:${contacto.email}" style="color:#1c84be;">${contacto.email || "—"}</a></td></tr>
        <tr><td style="padding:3px 16px 3px 0;color:#666;">Tel/WhatsApp</td>
            <td style="padding:3px 0;"><a href="https://wa.me/${(contacto.telefono||"").replace(/\D/g,"")}" style="color:#1c84be;">${contacto.telefono || "—"}</a></td></tr>
      </table>
    </div>

    <!-- Products table -->
    <div style="padding:24px 28px;">
      <h2 style="margin:0 0 12px;font-size:15px;color:#1c84be;text-transform:uppercase;letter-spacing:1px;">Productos solicitados</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#0f2028;color:#fff;">
            <th style="padding:9px 10px;text-align:center;width:55px;">Cant.</th>
            <th style="padding:9px 10px;text-align:left;">Parte (N/P)</th>
            <th style="padding:9px 10px;text-align:left;">Descripción</th>
            <th style="padding:9px 10px;text-align:center;width:90px;">Marca</th>
            <th style="padding:9px 10px;text-align:right;width:110px;">P. Unit. USD</th>
            <th style="padding:9px 10px;text-align:right;width:110px;">Total USD</th>
          </tr>
        </thead>
        <tbody style="border:1px solid #eaeae8;">
          ${rows}
          ${totalesHTML}
        </tbody>
      </table>
      ${subtotal === 0 ? '<p style="margin-top:8px;font-size:12px;color:#888;">* Todos los precios deben confirmarse en esta cotización.</p>' : '<p style="margin-top:8px;font-size:12px;color:#888;">* Los precios marcados como "Cotizar" deben confirmarse por separado.</p>'}
    </div>

    <!-- Footer -->
    <div style="background:#f4f4f2;padding:16px 28px;font-size:12px;color:#888;">
      Solicitud generada automáticamente desde <strong>MVP Industrial</strong> — ${config.domainName}
    </div>
  </div>
</body>
</html>`;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { items, contacto } = body;

    // Validate items
    if (!items?.length) {
      return NextResponse.json({ error: "Sin productos en la cotización." }, { status: 400 });
    }

    const { nombre, apellido, empresa, email, telefono } = contacto || {};
    if (!nombre || !apellido || !empresa) {
      return NextResponse.json({ error: "Completa los campos de nombre, apellido y empresa." }, { status: 400 });
    }
    if (!email && !telefono) {
      return NextResponse.json({ error: "Proporciona al menos un correo o teléfono de contacto." }, { status: 400 });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Correo electrónico inválido." }, { status: 400 });
    }

    // Check if user is logged in
    const session = await getServerSession(authOptions);
    const isLoggedIn = !!session?.user?.isApproved && !session?.user?.isAdmin;

    // Save to MongoDB
    await connectMongo();

    const cotizacionData = {
      items: items.map((i) => ({
        pn: i.pn,
        desc: i.desc || "",
        qty: Number(i.qty) || 1,
        precioUSD: Number(i.precioUSD) || 0,
        marca: i.marca || "",
        tiempoEntrega: i.tiempoEntrega || "",
      })),
      customerName: `${nombre} ${apellido}`.trim(),
      customerEmail: email || null,
      customerWhatsapp: telefono || null,
      customerEmpresa: empresa,
      source: isLoggedIn ? "web_loggedin" : "web_guest",
    };

    // Link to customer record if logged in
    if (isLoggedIn && session.user.customer?.id) {
      cotizacionData.customerId = session.user.customer.id;
    }

    await Cotizacion.create(cotizacionData);

    const subject = `Solicitud de cotización — ${nombre} ${apellido} · ${empresa}`;
    const html    = buildEmailHTML({ contacto, items });

    // Send via Mailgun
    if (process.env.MAILGUN_API_KEY) {
      const { sendEmail } = await import("@/libs/mailgun");
      await sendEmail({
        to:      config.mailgun.supportEmail,
        subject,
        html,
        replyTo: email,
      });
    } else {
      console.log("\n[COTIZACION — EMAIL NO CONFIGURADO]");
      console.log("Para:", config.mailgun.supportEmail);
      console.log("Asunto:", subject);
      console.log("Cliente:", nombre, apellido, "|", empresa, "|", email);
      console.log("Productos:", items.map((i) => `${i.qty}x ${i.pn}`).join(", "));
      console.log("─".repeat(60));
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[/api/cotizacion]", err);
    return NextResponse.json({ error: "Error interno. Intenta de nuevo." }, { status: 500 });
  }
}
