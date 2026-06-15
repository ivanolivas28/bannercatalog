import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * POST /api/odoo/webhook
 *
 * Receives event notifications from Odoo (e.g., quotation confirmed, order shipped).
 * Verifies the request signature when ODOO_WEBHOOK_SECRET is set.
 *
 * How to configure in Odoo:
 *   Settings → Technical → Automation → Webhooks (Odoo 17+)
 *   — Endpoint URL : https://yourdomain.com/api/odoo/webhook
 *   — Payload format: JSON
 *   — Secret header  : X-Odoo-Signature  (HMAC-SHA256 of raw body, hex-encoded)
 *
 * Required env vars:
 *   ODOO_WEBHOOK_SECRET — Shared secret configured in the Odoo webhook settings.
 *                         If not set, signature verification is skipped (not recommended for production).
 */

/**
 * Verify HMAC-SHA256 signature sent by Odoo.
 * Odoo sends: X-Odoo-Signature: <hex digest>
 * Computed as: HMAC-SHA256(secret, rawBody)
 *
 * NOTE: Verify the exact header name and algorithm in your Odoo version before deploying.
 *       Some Odoo versions / third-party modules may use different schemes.
 */
function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;

  try {
    const expected = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const sig = signatureHeader.replace(/^sha256=/, ""); // handle "sha256=..." prefix

    const expectedBuf = Buffer.from(expected, "utf8");
    const receivedBuf = Buffer.from(sig, "utf8");

    if (expectedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

export async function POST(req) {
  // ─── Read raw body for signature verification ────────────────────────────
  const rawBody = await req.text();

  // ─── Signature check ─────────────────────────────────────────────────────
  const webhookSecret = process.env.ODOO_WEBHOOK_SECRET;

  if (webhookSecret) {
    const sigHeader =
      req.headers.get("x-odoo-signature") ||
      req.headers.get("x-hub-signature-256") || // fallback alias some configs use
      "";

    if (!verifySignature(rawBody, sigHeader, webhookSecret)) {
      console.warn("[Odoo Webhook] Invalid or missing signature — request rejected");
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }
  } else {
    console.warn(
      "[Odoo Webhook] ODOO_WEBHOOK_SECRET is not set — signature verification skipped"
    );
  }

  // ─── Parse payload ───────────────────────────────────────────────────────
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  // ─── Handle event ────────────────────────────────────────────────────────
  const model  = payload?.model  || payload?.object || "unknown";
  const ids    = payload?.ids    || payload?.record_ids || [];
  const event  = payload?.event  || payload?.action || "unknown";

  console.log(`[Odoo Webhook] Received event="${event}" model="${model}" ids=${JSON.stringify(ids)}`);

  // Add your business logic here. Examples:
  //
  //   if (model === "sale.order" && event === "write") {
  //     const { syncOrderStatusToDB } = await import("@/libs/your-handler");
  //     await syncOrderStatusToDB(ids, payload);
  //   }
  //
  //   if (model === "stock.picking" && payload?.state === "done") {
  //     // Order shipped — notify customer, update internal status, etc.
  //   }

  return NextResponse.json({ received: true, model, event, ids });
}
