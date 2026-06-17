/**
 * Odoo Cloud XML-RPC client
 *
 * Required environment variables:
 *   ODOO_URL      — e.g. https://yourcompany.odoo.com
 *   ODOO_DB       — Database name, e.g. "yourcompany"
 *   ODOO_USER     — Login email
 *   ODOO_PASSWORD — Password or API key
 */

// ---------------------------------------------------------------------------
// XML-RPC serialization
// ---------------------------------------------------------------------------

function xmlVal(v) {
  if (v === null || v === undefined || v === false)
    return "<value><boolean>0</boolean></value>";
  if (typeof v === "boolean")
    return `<value><boolean>${v ? 1 : 0}</boolean></value>`;
  if (typeof v === "number" && Number.isInteger(v))
    return `<value><int>${v}</int></value>`;
  if (typeof v === "number")
    return `<value><double>${v}</double></value>`;
  if (typeof v === "string")
    return `<value><string>${v.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</string></value>`;
  if (Array.isArray(v))
    return `<value><array><data>${v.map(xmlVal).join("")}</data></array></value>`;
  if (typeof v === "object") {
    const members = Object.entries(v)
      .map(([k, val]) => `<member><name>${k}</name>${xmlVal(val)}</member>`)
      .join("");
    return `<value><struct>${members}</struct></value>`;
  }
  return `<value><string>${String(v)}</string></value>`;
}

function xmlBody(method, params) {
  return `<?xml version="1.0"?><methodCall><methodName>${method}</methodName><params>${
    params.map((p) => `<param>${xmlVal(p)}</param>`).join("")
  }</params></methodCall>`;
}

// ---------------------------------------------------------------------------
// XML-RPC recursive parser
// ---------------------------------------------------------------------------

function parseXml(xml) {
  let pos = 0;

  function skipWs() {
    while (pos < xml.length && /\s/.test(xml[pos])) pos++;
  }

  function readTag() {
    skipWs();
    if (xml[pos] !== "<") return null;
    const end = xml.indexOf(">", pos);
    const tag = xml.slice(pos + 1, end).trim();
    pos = end + 1;
    return tag;
  }

  function readUntilClose(tag) {
    const close = `</${tag}>`;
    const idx = xml.indexOf(close, pos);
    if (idx === -1) throw new Error(`XML-RPC parse: missing </${tag}>`);
    const content = xml.slice(pos, idx);
    pos = idx + close.length;
    return content;
  }

  function parseValue() {
    skipWs();
    // expect <value>
    if (!xml.startsWith("<value>", pos) && !xml.startsWith("<value ", pos)) {
      throw new Error(`XML-RPC parse: expected <value> at pos ${pos}`);
    }
    pos += xml.indexOf(">", pos) - pos + 1;
    skipWs();

    let result;

    if (xml.startsWith("<int>", pos) || xml.startsWith("<i4>", pos)) {
      const tag = xml.startsWith("<int>", pos) ? "int" : "i4";
      pos += tag.length + 2;
      result = parseInt(readUntilClose(tag), 10);
    } else if (xml.startsWith("<i8>", pos)) {
      pos += 4;
      result = parseInt(readUntilClose("i8"), 10);
    } else if (xml.startsWith("<double>", pos)) {
      pos += 8;
      result = parseFloat(readUntilClose("double"));
    } else if (xml.startsWith("<boolean>", pos)) {
      pos += 9;
      result = readUntilClose("boolean") === "1";
    } else if (xml.startsWith("<string>", pos)) {
      pos += 8;
      result = readUntilClose("string")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    } else if (xml.startsWith("<nil/>", pos) || xml.startsWith("<nil />", pos)) {
      pos += xml.startsWith("<nil/>", pos) ? 6 : 7;
      result = null;
    } else if (xml.startsWith("<array>", pos)) {
      pos += 7; // <array>
      skipWs();
      pos += 6; // <data>
      skipWs();
      result = [];
      while (!xml.startsWith("</data>", pos)) {
        result.push(parseValue());
        skipWs();
      }
      pos += 7; // </data>
      skipWs();
      pos += 8; // </array>
    } else if (xml.startsWith("<struct>", pos)) {
      pos += 8; // <struct>
      skipWs();
      result = {};
      while (!xml.startsWith("</struct>", pos)) {
        skipWs();
        pos += 8; // <member>
        skipWs();
        pos += 6; // <name>
        const nameEnd = xml.indexOf("</name>", pos);
        const key = xml.slice(pos, nameEnd);
        pos = nameEnd + 7; // </name>
        skipWs();
        result[key] = parseValue();
        skipWs();
        pos += 9; // </member>
        skipWs();
      }
      pos += 9; // </struct>
    } else {
      // bare string (no type tag)
      const end = xml.indexOf("</value>", pos);
      result = xml.slice(pos, end)
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
      pos = end;
    }

    skipWs();
    pos += 8; // </value>
    return result;
  }

  // Check for fault
  if (xml.includes("<fault>")) {
    const msgMatch = xml.match(/<name>faultString<\/name>\s*<value><string>([\s\S]*?)<\/string>/);
    throw new Error(`Odoo RPC error: ${msgMatch?.[1] || "XML-RPC fault"}`);
  }

  // Navigate to <params><param><value>
  const paramsIdx = xml.indexOf("<params>");
  if (paramsIdx === -1) throw new Error("XML-RPC parse: no <params>");
  pos = paramsIdx + 8;
  skipWs();
  pos += 7; // <param>
  skipWs();

  return parseValue();
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

let _uid = null;

async function xmlRpcCall(endpoint, method, params) {
  const url = `${process.env.ODOO_URL}${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/xml", Accept: "text/xml" },
    body: xmlBody(method, params),
  });
  if (!res.ok) throw new Error(`Odoo HTTP ${res.status} — ${url}`);
  return parseXml(await res.text());
}

async function callKw({ model, method, args = [], kwargs = {} }) {
  const uid = await ensureAuth();
  return xmlRpcCall("/xmlrpc/2/object", "execute_kw", [
    process.env.ODOO_DB,
    uid,
    process.env.ODOO_PASSWORD,
    model,
    method,
    args,
    { context: { lang: "es_MX", tz: "America/Monterrey" }, ...kwargs },
  ]);
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export async function odooAuth() {
  const uid = await xmlRpcCall("/xmlrpc/2/common", "authenticate", [
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

export async function findOrCreatePartner({ nombre, apellido, empresa, email, telefono }) {
  await ensureAuth();

  if (email) {
    const existing = await callKw({
      model: "res.partner",
      method: "search_read",
      args: [[["email", "=", email]]],
      kwargs: { fields: ["id", "name", "email"], limit: 1 },
    });
    if (Array.isArray(existing) && existing.length) return existing[0].id;
  }

  const vals = {
    name: `${nombre || ""} ${apellido || ""}`.trim() || empresa || "Cliente web",
    phone: telefono || false,
    company_type: "person",
  };
  if (email) vals.email = email;

  if (empresa) {
    const companies = await callKw({
      model: "res.partner",
      method: "search_read",
      args: [[["name", "ilike", empresa], ["is_company", "=", true]]],
      kwargs: { fields: ["id", "name"], limit: 1 },
    });
    if (Array.isArray(companies) && companies.length) {
      vals.parent_id = companies[0].id;
    } else {
      vals.parent_id = await callKw({
        model: "res.partner",
        method: "create",
        args: [{ name: empresa, is_company: true }],
      });
    }
  }

  return callKw({
    model: "res.partner",
    method: "create",
    args: [vals],
  });
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

function calcularSaleDelay(p) {
  if ((p.stockMX || 0) > 0) return 3;
  if ((p.stockUSA || 0) > 0 || (p.stockCHN || 0) > 0) return 12;
  if (p.leadTimeBanner > 0) return p.leadTimeBanner + 15;
  return 30;
}

export async function syncProductToOdoo(producto) {
  await ensureAuth();
  const { pn, desc, precioUSD, familia, categoria, marca } = producto;
  if (!pn) throw new Error("syncProductToOdoo: pn is required");

  const categName = familia || categoria || marca || "Automatización industrial";
  let categId = false;
  const foundCat = await callKw({
    model: "product.category",
    method: "search_read",
    args: [[["name", "=", categName]]],
    kwargs: { fields: ["id"], limit: 1 },
  });
  if (Array.isArray(foundCat) && foundCat.length) {
    categId = foundCat[0].id;
  } else {
    categId = await callKw({
      model: "product.category",
      method: "create",
      args: [{ name: categName }],
    });
  }

  const vals = {
    name: desc || pn,
    default_code: pn,
    list_price: precioUSD > 0 ? precioUSD : 0,
    description_sale: desc || "",
    sale_delay: calcularSaleDelay(producto),
    type: "product",
    ...(categId ? { categ_id: categId } : {}),
  };

  const existing = await callKw({
    model: "product.template",
    method: "search_read",
    args: [[["default_code", "=", pn]]],
    kwargs: { fields: ["id"], limit: 1 },
  });

  if (Array.isArray(existing) && existing.length) {
    await callKw({ model: "product.template", method: "write", args: [[existing[0].id], vals] });
    return { id: existing[0].id, created: false };
  }

  const newId = await callKw({ model: "product.template", method: "create", args: [vals] });
  return { id: newId, created: true };
}

export async function syncCatalogToOdoo(productos) {
  const errors = [];
  let synced = 0;
  for (const p of productos) {
    try {
      await syncProductToOdoo(p);
      synced++;
    } catch (err) {
      errors.push({ pn: p.pn || "?", error: err.message });
    }
  }
  return { synced, errors };
}

// ---------------------------------------------------------------------------
// Quotations (sale.order)
// ---------------------------------------------------------------------------

export async function createOdooQuotation({ contacto, items }) {
  await ensureAuth();

  const partnerId = await findOrCreatePartner(contacto);
  if (!partnerId) throw new Error("No se pudo crear o encontrar el cliente en Odoo");

  const orderLines = await Promise.all(
    items.map(async (item) => {
      const { pn, qty = 1, desc, precioUSD = 0, marca } = item;
      let productId = false;
      try {
        const products = await callKw({
          model: "product.product",
          method: "search_read",
          args: [[["default_code", "=", pn]]],
          kwargs: { fields: ["id"], limit: 1 },
        });
        if (Array.isArray(products) && products.length) productId = products[0].id;
      } catch (_) {}

      const lineVals = {
        product_uom_qty: qty,
        price_unit: precioUSD > 0 ? precioUSD : 0,
        name: `[${pn}] ${desc || ""}${marca ? ` — ${marca}` : ""}`.trim(),
        x_studio_tiempo_de_entrega_demm: item.tiempoEntrega || "",
      };
      if (productId) lineVals.product_id = productId;
      return [0, 0, lineVals];
    })
  );

  const soId = await callKw({
    model: "sale.order",
    method: "create",
    args: [{ partner_id: partnerId, order_line: orderLines, note: `Portal web — ${contacto.empresa || ""}`.trim() }],
  });

  const orders = await callKw({
    model: "sale.order",
    method: "read",
    args: [[soId], ["name"]],
  });

  const name = (Array.isArray(orders) && orders[0]?.name) ? orders[0].name : `SO-${soId}`;
  return { id: soId, name };
}
