/**
 * Odoo Cloud JSON-RPC client
 *
 * Required environment variables:
 *   ODOO_URL      — Base URL of your Odoo instance, e.g. https://yourcompany.odoo.com
 *   ODOO_DB       — Database name (usually the subdomain, e.g. "yourcompany")
 *   ODOO_USER     — Login email of the Odoo user / API user
 *   ODOO_PASSWORD — Password or API key for that user
 *
 * Optional:
 *   ODOO_SYNC_SECRET   — Bearer token to protect /api/odoo/sync
 *   ODOO_WEBHOOK_SECRET — Shared secret for verifying incoming Odoo webhooks
 */

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

let _session = null; // { uid, sessionId }

/**
 * Make a raw JSON-RPC call to Odoo.
 * @param {string} path   — URL path, e.g. "/web/dataset/call_kw" or "/web/session/authenticate"
 * @param {object} params — RPC params payload
 */
async function odooRpc(path, params) {
  const url = `${process.env.ODOO_URL}${path}`;

  const body = JSON.stringify({
    jsonrpc: "2.0",
    method: "call",
    id: Date.now(),
    params,
  });

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // Forward session cookie so authenticated calls work
  if (_session?.sessionId) {
    headers["Cookie"] = `session_id=${_session.sessionId}`;
  }

  const res = await fetch(url, { method: "POST", headers, body });

  if (!res.ok) {
    throw new Error(`Odoo HTTP ${res.status} ${res.statusText} — ${url}`);
  }

  const json = await res.json();

  if (json.error) {
    const msg =
      json.error?.data?.message || json.error?.message || JSON.stringify(json.error);
    throw new Error(`Odoo RPC error: ${msg}`);
  }

  return json.result;
}

/**
 * Make a call_kw JSON-RPC request (authenticated model method call).
 */
async function callKw({ model, method, args = [], kwargs = {} }) {
  return odooRpc("/web/dataset/call_kw", {
    model,
    method,
    args,
    kwargs: {
      context: { lang: "es_MX", tz: "America/Monterrey" },
      ...kwargs,
    },
  });
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/**
 * Authenticate with Odoo and cache the session.
 * Returns { uid, sessionId }
 */
export async function odooAuth() {
  const result = await odooRpc("/web/session/authenticate", {
    db: process.env.ODOO_DB,
    login: process.env.ODOO_USER,
    password: process.env.ODOO_PASSWORD,
  });

  if (!result?.uid) {
    throw new Error("Odoo authentication failed — check ODOO_USER and ODOO_PASSWORD");
  }

  // The session_id lives in the Set-Cookie header; Odoo also returns it in the result
  const sessionId = result.session_id || "";
  _session = { uid: result.uid, sessionId };
  return _session;
}

/**
 * Ensure we have a valid session (authenticate if we don't).
 */
async function ensureAuth() {
  if (!_session) {
    await odooAuth();
  }
  return _session;
}

// ---------------------------------------------------------------------------
// Partners (res.partner)
// ---------------------------------------------------------------------------

/**
 * Find an existing partner by email, or create one.
 * Returns the Odoo partner ID.
 */
export async function findOrCreatePartner({ nombre, apellido, empresa, email, telefono }) {
  await ensureAuth();

  // 1. Search by email
  const existing = await callKw({
    model: "res.partner",
    method: "search_read",
    args: [[["email", "=", email]]],
    kwargs: { fields: ["id", "name", "email"], limit: 1 },
  });

  if (existing?.length) {
    return existing[0].id;
  }

  // 2. Create new partner
  const vals = {
    name: `${nombre} ${apellido}`.trim(),
    email,
    phone: telefono || false,
    company_type: "person",
    comment: empresa ? `Empresa: ${empresa}` : false,
  };

  // Attempt to find / create the company and link it
  if (empresa) {
    const companies = await callKw({
      model: "res.partner",
      method: "search_read",
      args: [[["name", "ilike", empresa], ["is_company", "=", true]]],
      kwargs: { fields: ["id", "name"], limit: 1 },
    });

    if (companies?.length) {
      vals.parent_id = companies[0].id;
    } else {
      const companyId = await callKw({
        model: "res.partner",
        method: "create",
        args: [{ name: empresa, is_company: true }],
      });
      vals.parent_id = companyId;
    }
    // Remove redundant comment when company is linked
    delete vals.comment;
  }

  const partnerId = await callKw({
    model: "res.partner",
    method: "create",
    args: [vals],
  });

  return partnerId;
}

// ---------------------------------------------------------------------------
// Product categories
// ---------------------------------------------------------------------------

/**
 * Find or create a product.category by name.
 * Returns the category ID.
 */
async function findOrCreateCategoria(nombre) {
  if (!nombre) return false;

  const found = await callKw({
    model: "product.category",
    method: "search_read",
    args: [[["name", "=", nombre]]],
    kwargs: { fields: ["id", "name"], limit: 1 },
  });

  if (found?.length) return found[0].id;

  return callKw({
    model: "product.category",
    method: "create",
    args: [{ name: nombre }],
  });
}

// ---------------------------------------------------------------------------
// Products (product.template / product.product)
// ---------------------------------------------------------------------------

/**
 * Calculate delivery lead time in days using the same logic as getEntregaInfo.
 */
function calcularSaleDelay(p) {
  if ((p.stockMX || 0) > 0) return 3;
  if ((p.stockUSA || 0) > 0 || (p.stockCHN || 0) > 0) return 12;
  if (p.leadTimeBanner > 0) return p.leadTimeBanner + 15;
  return 30; // fallback when no data available
}

/**
 * Sync a single product to Odoo — create or update product.template by internal reference (pn).
 *
 * @param {object} producto — { pn, desc, precioUSD, stockMX, stockUSA, stockCHN, leadTimeBanner, marca, categoria, familia, sourcingJun }
 * @returns {{ id: number, created: boolean }}
 */
export async function syncProductToOdoo(producto) {
  await ensureAuth();

  const { pn, desc, precioUSD, marca, categoria, familia } = producto;

  if (!pn) throw new Error("syncProductToOdoo: pn is required");

  // Resolve category
  const categName = familia || categoria || marca || "Automatización industrial";
  const categId = await findOrCreateCategoria(categName);

  const vals = {
    name: desc || pn,
    default_code: pn,
    list_price: precioUSD > 0 ? precioUSD : 0,
    description_sale: desc || "",
    sale_delay: calcularSaleDelay(producto),
    type: "product",
    ...(categId ? { categ_id: categId } : {}),
  };

  // Try to find existing product by internal reference
  const existing = await callKw({
    model: "product.template",
    method: "search_read",
    args: [[["default_code", "=", pn]]],
    kwargs: { fields: ["id", "name", "default_code"], limit: 1 },
  });

  if (existing?.length) {
    await callKw({
      model: "product.template",
      method: "write",
      args: [[existing[0].id], vals],
    });
    return { id: existing[0].id, created: false };
  }

  // Create new product
  const newId = await callKw({
    model: "product.template",
    method: "create",
    args: [vals],
  });

  return { id: newId, created: true };
}

/**
 * Batch-sync all catalog products to Odoo.
 * Never throws — errors are collected per-product.
 *
 * @param {object[]} productos
 * @returns {{ synced: number, errors: Array<{ pn: string, error: string }> }}
 */
export async function syncCatalogToOdoo(productos) {
  const errors = [];
  let synced = 0;

  for (const producto of productos) {
    try {
      await syncProductToOdoo(producto);
      synced++;
    } catch (err) {
      errors.push({ pn: producto.pn || "?", error: err.message });
    }
  }

  return { synced, errors };
}

// ---------------------------------------------------------------------------
// Quotations (sale.order + sale.order.line)
// ---------------------------------------------------------------------------

/**
 * Create a quotation in Odoo from contacto + items.
 *
 * @param {object} opts
 * @param {object} opts.contacto — { nombre, apellido, empresa, email, telefono }
 * @param {Array}  opts.items    — [{ pn, qty, desc, precioUSD, marca }]
 * @returns {{ id: number, name: string }}
 */
export async function createOdooQuotation({ contacto, items }) {
  await ensureAuth();

  // 1. Find or create the partner
  const partnerId = await findOrCreatePartner(contacto);

  // 2. Build order lines
  //    For each item we try to find the matching product.product by default_code.
  //    If not found, we use a fallback with just the description (no product link).
  const orderLines = await Promise.all(
    items.map(async (item) => {
      const { pn, qty = 1, desc, precioUSD = 0, marca } = item;

      // Try to resolve the internal product
      let productId = false;
      try {
        const products = await callKw({
          model: "product.product",
          method: "search_read",
          args: [[["default_code", "=", pn]]],
          kwargs: { fields: ["id", "name"], limit: 1 },
        });
        if (products?.length) productId = products[0].id;
      } catch (_) {
        // Non-fatal: proceed without linking product
      }

      // sale.order.line tuple: (0, 0, vals) = create
      const lineVals = {
        product_uom_qty: qty,
        price_unit: precioUSD > 0 ? precioUSD : 0,
        name: desc || `${pn}${marca ? ` — ${marca}` : ""}`,
      };
      if (productId) lineVals.product_id = productId;
      // When no product linked we still need product_id (can be 0 in some Odoo versions)
      // For maximum compatibility we omit it and set name manually above

      return [0, 0, lineVals];
    })
  );

  // 3. Create the sale.order
  const soVals = {
    partner_id: partnerId,
    order_line: orderLines,
    note: `Cotización generada desde el portal web — ${contacto.empresa || ""}`.trim(),
    // client_order_ref can store the customer's reference if needed
  };

  const soId = await callKw({
    model: "sale.order",
    method: "create",
    args: [soVals],
  });

  // 4. Read back the order name (e.g. "S00042")
  const orders = await callKw({
    model: "sale.order",
    method: "read",
    args: [[soId], ["name"]],
  });

  const name = orders?.[0]?.name || `SO-${soId}`;

  return { id: soId, name };
}
