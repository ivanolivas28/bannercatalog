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
// Low-level helpers — XML-RPC over HTTPS
// ---------------------------------------------------------------------------

let _uid = null; // cached uid after authenticate

function xmlVal(value) {
  if (value === false || value === null || value === undefined)
    return "<value><boolean>0</boolean></value>";
  if (typeof value === "number" && Number.isInteger(value))
    return `<value><int>${value}</int></value>`;
  if (typeof value === "number")
    return `<value><double>${value}</double></value>`;
  if (typeof value === "boolean")
    return `<value><boolean>${value ? 1 : 0}</boolean></value>`;
  if (typeof value === "string")
    return `<value><string>${value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</string></value>`;
  if (Array.isArray(value))
    return `<value><array><data>${value.map(xmlVal).join("")}</data></array></value>`;
  if (typeof value === "object") {
    const members = Object.entries(value)
      .map(([k, v]) => `<member><name>${k}</name>${xmlVal(v)}</member>`)
      .join("");
    return `<value><struct>${members}</struct></value>`;
  }
  return `<value><string>${String(value)}</string></value>`;
}

function xmlRpcBody(method, params) {
  return `<?xml version="1.0"?><methodCall><methodName>${method}</methodName><params>${
    params.map((p) => `<param>${xmlVal(p)}</param>`).join("")
  }</params></methodCall>`;
}

function parseXmlRpcFull(xml) {
  // Use DOMParser-like approach via regex for Node.js environment
  // Extract the methodResponse > params > param > value content
  function parseValue(str) {
    str = str.trim();
    const int = str.match(/^<int>(.*?)<\/int>$/) || str.match(/^<i4>(.*?)<\/i4>$/);
    if (int) return parseInt(int[1], 10);
    const dbl = str.match(/^<double>(.*?)<\/double>$/);
    if (dbl) return parseFloat(dbl[1]);
    const bool = str.match(/^<boolean>(.*?)<\/boolean>$/);
    if (bool) return bool[1] === "1";
    const str2 = str.match(/^<string>([\s\S]*?)<\/string>$/);
    if (str2) return str2[1].replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">");
    if (str.startsWith("<array>")) {
      const data = str.match(/<data>([\s\S]*?)<\/data>/)?.[1] || "";
      const items = [];
      const valRe = /<value>([\s\S]*?)<\/value>/g;
      let m;
      while ((m = valRe.exec(data)) !== null) items.push(parseValue(m[1].trim()));
      return items;
    }
    if (str.startsWith("<struct>")) {
      const obj = {};
      const memberRe = /<member><name>(.*?)<\/name><value>([\s\S]*?)<\/value><\/member>/g;
      let m;
      while ((m = memberRe.exec(str)) !== null) obj[m[1]] = parseValue(m[2].trim());
      return obj;
    }
    // bare value (no type tag) = string
    if (!str.startsWith("<")) return str;
    return str;
  }

  if (xml.includes("<fault>")) {
    const msg = xml.match(/<name>faultString<\/name>\s*<value><string>([\s\S]*?)<\/string>/)?.[1] || "XML-RPC fault";
    throw new Error(`Odoo RPC error: ${msg}`);
  }

  const valueMatch = xml.match(/<params>\s*<param>\s*<value>([\s\S]*?)<\/value>\s*<\/param>/);
  if (!valueMatch) return null;
  return parseValue(valueMatch[1].trim());
}

function parseXmlRpcResponse(xml) {
  if (xml.includes("<fault>")) {
    const msg = xml.match(/<name>faultString<\/name>\s*<value><string>(.*?)<\/string>/s)?.[1] || "XML-RPC fault";
    throw new Error(`Odoo RPC error: ${msg}`);
  }
  // Extract first value — handles int, string, boolean, array, struct
  const intMatch = xml.match(/<value><int>(.*?)<\/int>/);
  if (intMatch) return parseInt(intMatch[1], 10);
  const i4Match = xml.match(/<value><i4>(.*?)<\/i4>/);
  if (i4Match) return parseInt(i4Match[1], 10);
  const strMatch = xml.match(/<value><string>([\s\S]*?)<\/string>/);
  if (strMatch) return strMatch[1];
  const boolMatch = xml.match(/<value><boolean>(.*?)<\/boolean>/);
  if (boolMatch) return boolMatch[1] === "1";
  // For arrays/structs we return the raw XML — callers that need structured data handle it
  return xml;
}

async function xmlRpc(endpoint, method, params) {
  const url = `${process.env.ODOO_URL}${endpoint}`;
  const body = xmlRpcBody(method, params);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/xml", Accept: "text/xml" },
    body,
  });

  if (!res.ok) throw new Error(`Odoo HTTP ${res.status} — ${url}`);

  const text = await res.text();
  return parseXmlRpcResponse(text);
}

// For object/execute calls we need a JSON-compatible response — use JSON-RPC only for execute_kw
async function jsonRpc(path, method, params) {
  const url = `${process.env.ODOO_URL}${path}`;
  const body = JSON.stringify({ jsonrpc: "2.0", method: "call", id: Date.now(), params });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body,
  });
  if (!res.ok) throw new Error(`Odoo HTTP ${res.status} — ${url}`);
  const json = await res.json();
  if (json.error) {
    const msg = json.error?.data?.message || json.error?.message || JSON.stringify(json.error);
    throw new Error(`Odoo RPC error: ${msg}`);
  }
  return json.result;
}

async function callKw({ model, method, args = [], kwargs = {} }) {
  const uid = await ensureAuth();
  // XML-RPC execute_kw: standard external API for Odoo
  const result = await fetch(`${process.env.ODOO_URL}/xmlrpc/2/object`, {
    method: "POST",
    headers: { "Content-Type": "text/xml", Accept: "text/xml" },
    body: xmlRpcBody("execute_kw", [
      process.env.ODOO_DB,
      uid,
      process.env.ODOO_PASSWORD,
      model,
      method,
      args,
      { context: { lang: "es_MX", tz: "America/Monterrey" }, ...kwargs },
    ]),
  });

  if (!result.ok) throw new Error(`Odoo HTTP ${result.status}`);
  const text = await result.text();

  if (text.includes("<fault>")) {
    const msg = text.match(/<name>faultString<\/name>\s*<value><string>([\s\S]*?)<\/string>/)?.[1] || "XML-RPC fault";
    throw new Error(`Odoo RPC error: ${msg}`);
  }

  // Parse response — try JSON-like extraction for arrays/structs
  return parseXmlRpcFull(text);
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export async function odooAuth() {
  const uid = await xmlRpc("/xmlrpc/2/common", "authenticate", [
    process.env.ODOO_DB,
    process.env.ODOO_USER,
    process.env.ODOO_PASSWORD,
    {},
  ]);

  if (!uid || uid === false || uid === 0) {
    throw new Error("Odoo authentication failed — check ODOO_USER and ODOO_PASSWORD");
  }

  _uid = uid;
  return { uid };
}

async function ensureAuth() {
  if (!_uid) await odooAuth();
  return _uid;
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
