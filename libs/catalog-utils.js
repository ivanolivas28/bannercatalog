// Catalog utility functions — ported from the static site

export const CATALOG_CONFIG = {
  WHATSAPP: "5261400000000",
  TU_NOMBRE: "EQKOR",
  DOMINIO: process.env.NEXT_PUBLIC_DOMINIO || "https://TU-DOMINIO.com",
  SOURCING_EXTRA_DIAS: 15,
  // Served from /public/data/ in development
  LOCAL_MX:       "/data/TFG - Inventario General (1).csv",
  LOCAL_USA:      "/data/MFG - Inventario General.csv",
  LOCAL_CHN:      "/data/NFG - Inventario General.csv",
  LOCAL_BANNER:   "/data/banner_pricelist_download_20260505.txt",
  LOCAL_SOURCING: "/data/Sourcing Item Jun 26.csv",
  // Google Sheets URLs for production
  SHEET_MX:       "https://docs.google.com/spreadsheets/d/TU_ID_MX/export?format=csv&gid=0",
  SHEET_USA:      "https://docs.google.com/spreadsheets/d/TU_ID_USA/export?format=csv&gid=0",
  SHEET_CHN:      "https://docs.google.com/spreadsheets/d/TU_ID_CHN/export?format=csv&gid=0",
  SHEET_BANNER:   "https://docs.google.com/spreadsheets/d/TU_ID_BANNER/export?format=csv&gid=0",
  SHEET_SOURCING: "https://docs.google.com/spreadsheets/d/TU_ID_SOURCING/export?format=csv&gid=0",
};

const REGLAS_MARCA = [
  { marca: "BANNER",    regex: /^(S18|QS|T30|T18|Q45|P|DF|EZ|K50|K70|K80|MB|PVA|BRT|LG|PD|VE|WORLD)/i },
  { marca: "SCHNEIDER", regex: /^(TM|ATV|ATS|LRD?|NSX|NXX|LC1|LC2|LR|GV|A9|RM|XB|XS|XV|XY|RE|LT|NSYC|BMXC|BMEP|140|TSX)/i },
  { marca: "TURCK",     regex: /^(BI|NI|BC|BL|FCS|LI|RU|RM|PKG|PSG|BIM|NIM|VB|VG|TBEN|TBIL|TBPN|RSB|YF|UPROX|Bi|Ni)/i },
  { marca: "WAGO",      regex: /^(280|281|285|287|221|222|231|232|233|234|235|236|237|238|239|243|250|251|255|256|257|258|259|261|262|263|264|265|266|267|268|269|270|750|751|753|787|789|855|859)/i },
];

export function detectarMarca(pn) {
  for (const r of REGLAS_MARCA) {
    if (r.regex.test(pn)) return r.marca;
  }
  return "OTRO";
}

export const CATEGORIAS_BU = {
  "10": "Sensores fotoeléctricos",
  "20": "Sensores de medición avanzada",
  "30": "Seguridad industrial",
  "40": "Visión y códigos de barras",
  "50": "Conectividad inalámbrica e IIoT",
  "60": "Indicadores y luces industriales",
  "80": "Conectividad y cableado",
};

// Subcategory chips per category — each entry is { label, keywords[] matched against description
export const SUBCATEGORIAS = {
  "Sensores fotoeléctricos": [
    { label: "Difuso",            keywords: ["diffuse"] },
    { label: "Campo fijo",        keywords: ["fixed field"] },
    { label: "Polarizado",        keywords: ["polarized"] },
    { label: "Retroreflectivo",   keywords: ["retroreflective"] },
    { label: "Láser",             keywords: ["laser"] },
    { label: "Fibra óptica",      keywords: ["fiber optic"] },
    { label: "Convergente",       keywords: ["convergent"] },
    { label: "Supresión de fondo",keywords: ["background suppression"] },
  ],
  "Indicadores y luces industriales": [
    { label: "Torre de señal",    keywords: ["tower"] },
    { label: "Indicador",         keywords: ["indicator"] },
    { label: "Strip LED",         keywords: ["strip"] },
    { label: "Beacon",            keywords: ["beacon"] },
    { label: "Audible / Alarma",  keywords: ["audible", "alarm"] },
    { label: "Worklight",         keywords: ["worklight", "work light"] },
  ],
  "Seguridad industrial": [
    { label: "Cortina de luz",    keywords: ["light curtain", "ez screen"] },
    { label: "Paro de emergencia",keywords: ["e-stop", "emergency stop"] },
    { label: "Interlock",         keywords: ["interlock"] },
    { label: "Jale de cuerda",    keywords: ["rope pull"] },
    { label: "Muting",            keywords: ["muting"] },
    { label: "Two-hand",          keywords: ["two-hand"] },
    { label: "Relay de seguridad",keywords: ["safety relay"] },
  ],
  "Sensores de medición avanzada": [
    { label: "Ultrasónico",       keywords: ["ultrasonic"] },
    { label: "Laser de distancia",keywords: ["laser", "distance"] },
    { label: "Array / Cortina",   keywords: ["array"] },
    { label: "Triangulación",     keywords: ["triangulation"] },
  ],
};

export function nombreCategoria(bu) {
  return CATEGORIAS_BU[String(bu ?? "").trim()] || "";
}

function categoriaDefault(marca) {
  const cats = {
    BANNER: "Sensores y seguridad",
    SCHNEIDER: "Control eléctrico",
    TURCK: "Sensores industriales",
    WAGO: "Conectividad y terminales",
    OTRO: "Automatización",
  };
  return cats[marca] || "Automatización industrial";
}

export function parsearCSV(linea) {
  const res = [];
  let campo = "";
  let enComillas = false;
  for (const c of linea) {
    if (c === "\r") continue;
    if (c === '"') { enComillas = !enComillas; continue; }
    if (c === "," && !enComillas) { res.push(campo); campo = ""; continue; }
    campo += c;
  }
  res.push(campo);
  return res;
}

export function parsearSheet(csv, origen) {
  const lineas = csv.trim().split("\n");
  if (!lineas.length) return [];

  const encabezado = parsearCSV(lineas[0]).map((h) => h.trim().toLowerCase());
  const esProveedor =
    encabezado.some((h) => h.includes("numero de parte")) &&
    encabezado.some((h) => h.includes("cantidad"));

  const idxPN  = esProveedor ? encabezado.findIndex((h) => h.includes("descrip")) : 0;
  const idxQty = esProveedor ? encabezado.findIndex((h) => h.includes("cantidad")) : 1;
  const idxID  = esProveedor ? encabezado.findIndex((h) => h.includes("numero de parte")) : -1;

  const acumulado = new Map();

  lineas.slice(1).forEach((linea) => {
    const cols = parsearCSV(linea);
    const pn   = cols[idxPN]?.trim().toUpperCase();
    const qty  = parseInt(cols[idxQty]) || 0;
    if (!pn || qty <= 0) return;

    const marca = detectarMarca(pn);
    const id    = idxID >= 0 ? cols[idxID]?.trim() : "";

    if (acumulado.has(pn)) {
      acumulado.get(pn).qty += qty;
    } else {
      acumulado.set(pn, { pn, qty, origen, marca, id, desc: "", cat: categoriaDefault(marca) });
    }
  });

  return Array.from(acumulado.values());
}

export function parsearBannerPricelist(csv) {
  const lineas = csv.trim().split("\n");
  if (!lineas.length) return [];

  const enc = parsearCSV(lineas[0]).map((h) => h.trim().toLowerCase());
  const idxPN     = enc.findIndex((h) => h.includes("model number"));
  const idxDesc   = enc.findIndex((h) => h === "description");
  const idxPrecio = enc.findIndex((h) => h.includes("list price"));
  const idxLead   = enc.findIndex((h) => h.includes("lead time"));
  const idxImg    = enc.findIndex((h) => h.includes("image url") && !h.includes("image 2"));
  const idxFam    = enc.findIndex((h) => h.includes("family name"));
  const idxBU     = enc.findIndex((h) => h.includes("business unit"));
  const idxURL    = enc.findIndex((h) => h === "website url");
  const idxOrigin = enc.findIndex((h) => h.includes("country of origin"));

  if (idxPN < 0) return [];

  return lineas.slice(1).map((linea) => {
    const cols = parsearCSV(linea);
    const pn   = cols[idxPN]?.trim().toUpperCase();
    if (!pn) return null;

    const leadTime       = idxLead >= 0   ? parseInt(cols[idxLead]) || 0       : 0;
    const desc           = idxDesc >= 0   ? cols[idxDesc]?.trim()               : "";
    const precio         = idxPrecio >= 0 ? parseFloat(cols[idxPrecio]) || 0   : 0;
    const imagen         = idxImg >= 0    ? cols[idxImg]?.trim()                : "";
    const familia        = idxFam >= 0    ? cols[idxFam]?.trim()                : "";
    const bu             = idxBU >= 0     ? cols[idxBU]?.trim()                 : "";
    const urlProducto    = idxURL >= 0    ? cols[idxURL]?.trim()                : "";
    const countryOfOrigin = idxOrigin >= 0 ? cols[idxOrigin]?.trim().toUpperCase() : "";
    const categoria      = nombreCategoria(bu);

    return {
      pn, desc, leadTimeBanner: leadTime, precioUSD: precio,
      imagen, businessUnit: bu, categoria, familia,
      cat: familia || categoriaDefault("BANNER"),
      marca: "BANNER", urlProducto, countryOfOrigin,
    };
  }).filter(Boolean);
}

// Returns Map<MODEL_NUMBER_UPPERCASE, sourcingRoute>
export function parsearSourcing(csv) {
  const lineas = csv.trim().split("\n");
  if (lineas.length < 2) return new Map();

  const enc = parsearCSV(lineas[0]).map((h) => h.trim().toLowerCase());
  const idxPN  = enc.findIndex((h) => h.includes("description"));
  const idxRut = enc.findIndex((h) => h.includes("sourcing jun"));

  if (idxPN < 0 || idxRut < 0) return new Map();

  const mapa = new Map();
  lineas.slice(1).forEach((linea) => {
    const cols = parsearCSV(linea);
    const pn   = cols[idxPN]?.trim().toUpperCase();
    const ruta = cols[idxRut]?.trim();
    if (pn && ruta) mapa.set(pn, ruta);
  });
  return mapa;
}

// Splits CSV text into logical rows, respecting quoted fields that contain newlines
function splitCSVRows(csv) {
  const rows = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === "\n" || (ch === "\r" && csv[i + 1] === "\n")) && !inQuotes) {
      if (ch === "\r") i++; // skip \n after \r
      rows.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) rows.push(current);
  return rows;
}

// Returns Map<PN_UPPERCASE, { precioRemate, precioOriginal, precioMXN, cantidad, desc }>
// Supports two formats:
// Format A (EQKOR remate): row 0 = group headers, row 1 = real headers (Part number, Descripcion, Cantidad disponible, Precio en USD contado, Precio en MXN contado, Precio en USD factura, ...)
// Format B (generic): single header row with pn/desc/precioRemate/precioOriginal columns
export function parsearRemate(csv) {
  if (!csv?.trim()) return new Map();
  const lineas = splitCSVRows(csv).filter((l) => l.trim());
  if (lineas.length < 2) return new Map();

  // Detect Format A: second row has "Part number" or "part number"
  const row0 = parsearCSV(lineas[0]).map((h) => h.trim().toLowerCase());
  const row1 = parsearCSV(lineas[1]).map((h) => h.trim().toLowerCase());

  let headers, dataStart;
  if (row1.some((h) => h.includes("part number") || h.includes("part_number"))) {
    // Format A — skip group header row, use row 1 as headers
    headers = row1;
    dataStart = 2;
  } else {
    headers = row0;
    dataStart = 1;
  }

  const idxPN       = headers.findIndex((h) => h.includes("part number") || h.includes("part_number") || h.includes("pn") || h.includes("parte") || h.includes("model"));
  const idxDesc     = headers.findIndex((h) => h.includes("desc"));
  const idxCantidad = headers.findIndex((h) => h.includes("cantidad") || h.includes("qty") || h.includes("stock"));
  // All columns that mention "precio en usd" or "usd" — first = contado, second = factura
  const allUSD = headers.reduce((acc, h, i) => (h.includes("precio en usd") || h.includes("precio_usd") || h.includes("usd")) ? [...acc, i] : acc, []);
  const idxRemate   = allUSD.length > 0 ? allUSD[0] : headers.findIndex((h) => h.includes("remate") || h.includes("oferta") || h.includes("sale") || h.includes("precio"));
  const idxOriginal = allUSD.length > 1 ? allUSD[1] : -1;

  if (idxPN < 0 || idxRemate < 0) return new Map();

  const mapa = new Map();
  lineas.slice(dataStart).forEach((linea) => {
    const cols = parsearCSV(linea);
    const pn = cols[idxPN]?.trim().toUpperCase();
    const precioRemate = parseFloat(String(cols[idxRemate] || "").replace(/[^0-9.]/g, "")) || 0;
    if (!pn || !precioRemate) return;
    mapa.set(pn, {
      precioRemate,
      precioOriginal: idxOriginal >= 0 ? parseFloat(String(cols[idxOriginal] || "").replace(/[^0-9.]/g, "")) || 0 : 0,
      cantidad: idxCantidad >= 0 ? parseInt(cols[idxCantidad]) || 0 : 0,
      desc: idxDesc >= 0 ? cols[idxDesc]?.trim() : "",
    });
  });
  return mapa;
}

export function mergear(mx, usa, banner = [], nfg = [], sourcingMap = new Map()) {
  const mapa = new Map();

  mx.forEach((p) => mapa.set(p.pn, { ...p, stockMX: p.qty, stockUSA: 0, stockCHN: 0 }));

  usa.forEach((p) => {
    if (mapa.has(p.pn)) {
      mapa.get(p.pn).stockUSA = p.qty;
    } else {
      mapa.set(p.pn, { ...p, stockMX: 0, stockUSA: p.qty, stockCHN: 0 });
    }
  });

  nfg.forEach((p) => {
    if (mapa.has(p.pn)) {
      mapa.get(p.pn).stockCHN = p.qty;
    } else {
      mapa.set(p.pn, { ...p, stockMX: 0, stockUSA: 0, stockCHN: p.qty });
    }
  });

  banner.forEach((b) => {
    if (mapa.has(b.pn)) {
      const ex = mapa.get(b.pn);
      if (!ex.desc && b.desc) ex.desc = b.desc;
      ex.leadTimeBanner = b.leadTimeBanner;
      ex.precioUSD = b.precioUSD;
      ex.imagen = b.imagen;
      ex.urlProducto = b.urlProducto;
      ex.businessUnit = b.businessUnit;
      ex.categoria = b.categoria;
      ex.familia = b.familia;
      ex.countryOfOrigin = b.countryOfOrigin || "";
      if (b.familia) ex.cat = b.familia;
      else if (b.categoria && (!ex.cat || ex.cat === categoriaDefault(ex.marca))) ex.cat = b.categoria;
    } else {
      mapa.set(b.pn, { ...b, stockMX: 0, stockUSA: 0, stockCHN: 0, qty: 0, origen: "BANNER" });
    }
  });

  // Attach sourcing route to every product
  mapa.forEach((p) => {
    p.sourcingJun = sourcingMap.get(p.pn) || null;
  });

  return Array.from(mapa.values());
}

export function getEntregaInfo(p) {
  // STEP 1 — Always check MX stock first
  if (p.stockMX > 0) {
    return { tipo: "mx", texto: "🇲🇽 En stock", tiempo: "Entrega 3–4 días hábiles" };
  }

  const sourcing = p.sourcingJun || "USA to MTY";
  const esCHN = sourcing === "CHN to MTY";
  // Products made in China cannot be imported via USA — only via CHN to MTY sourcing route
  const origenChina = p.countryOfOrigin === "CN";

  // STEP 2 — Route-dependent warehouse check
  if (esCHN) {
    if (p.stockCHN > 0) {
      return { tipo: "usa", texto: "🇨🇳 En stock", tiempo: "Entrega 10–15 días hábiles" };
    }
  } else if (!origenChina) {
    // SLP to MTY or USA to MTY — only use USA stock if product is NOT made in China
    if (p.stockUSA > 0) {
      return { tipo: "usa", texto: "🇺🇸 En stock", tiempo: "Entrega 10–15 días hábiles" };
    }
  }
  // If origenChina && !esCHN: skip USA stock — must order from factory

  // STEP 3 — No usable stock, show manufacturing lead time
  if (!p.leadTimeBanner) {
    return { tipo: "consultar", texto: "Bajo pedido", tiempo: "Consultar disponibilidad" };
  }
  const total = p.leadTimeBanner + CATALOG_CONFIG.SOURCING_EXTRA_DIAS;
  return { tipo: "pedido", texto: "Bajo pedido", tiempo: `Entrega ~${total} días hábiles` };
}

export function nombreFriendly(pn, marca) {
  const prefijos = {
    S18: "Sensor fotoeléctrico", QS: "Sensor miniatura", T30: "Sensor ultrasonido",
    EZ: "Cortina de seguridad", K50: "Torre de señalización", K70: "Torre LED",
    TM2: "PLC Modicon M2", TM3: "Módulo expansión M2", ATV: "Variador de velocidad",
    LRD: "Relé térmico", NSX: "Interruptor automático", LC1: "Contactor",
    XB4: "Pulsador / selector", BI: "Sensor inductivo", NI: "Sensor inductivo",
    TBEN: "Módulo I/O IP67", BL: "Conector industrial",
    "280": "Terminal feedthrough", "750": "Controlador WAGO", "787": "Fuente EPSITRON",
    "221": "Conector push-in", "231": "Regleta de bornes",
  };
  for (const [pref, nombre] of Object.entries(prefijos)) {
    if (pn.startsWith(pref)) return `${nombre} · ${marca}`;
  }
  return `Componente de automatización · ${marca}`;
}

export function formatPrecioUSD(precio) {
  const n = parseFloat(precio);
  if (!n || n <= 0) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(n);
}

export function imagenProducto(p) {
  const url = p?.imagen?.trim();
  return url && /^https?:\/\//i.test(url) ? url : "";
}

export function filtrarProductos(productos, { busqueda, filtroActivo, filtroCategoria, filtroSubcategoria, filtroFamilia }) {
  let res = [...productos];
  const q = (busqueda || "").toLowerCase();

  if (q) {
    res = res.filter(
      (p) =>
        p.pn.toLowerCase().includes(q) ||
        p.marca.toLowerCase().includes(q) ||
        (p.desc || "").toLowerCase().includes(q) ||
        (p.categoria || "").toLowerCase().includes(q) ||
        (p.familia || "").toLowerCase().includes(q)
    );
  }

  if (filtroActivo === "MX")       res = res.filter((p) => p.stockMX > 0);
  else if (filtroActivo === "REMATE") res = res.filter((p) => p.esRemate);
  else if (filtroActivo !== "all") res = res.filter((p) => p.marca === filtroActivo);

  if (filtroCategoria) res = res.filter((p) => p.categoria === filtroCategoria);
  if (filtroSubcategoria?.keywords?.length) {
    const kws = filtroSubcategoria.keywords.map((k) => k.toLowerCase());
    res = res.filter((p) => {
      const d = (p.desc || "").toLowerCase();
      return kws.some((k) => d.includes(k));
    });
  }
  if (filtroFamilia)   res = res.filter((p) => p.familia === filtroFamilia);

  res.sort((a, b) => {
    const w = (p) => {
      if (p.stockMX > 0)        return 0;
      if (p.stockUSA > 0)       return 1;
      if (p.leadTimeBanner > 0) return 2;
      return 3;
    };
    return w(a) - w(b);
  });

  return res;
}

export async function cargarCatalogo() {
  const esLocal = process.env.NODE_ENV === "development";
  const tieneBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

  const fetchText = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  };

  // If Blob token is present, resolve signed URLs via internal API
  async function resolveUrl(pathname, sheetUrl, localUrl) {
    if (tieneBlob) {
      const base = process.env.NEXTAUTH_URL || "https://tienda.eqkor.mx";
      return `${base}/api/admin/blob-proxy?file=${pathname}`;
    }
    if (esLocal) return localUrl;
    return sheetUrl;
  }

  const urls = await Promise.all([
    resolveUrl("mx.csv",      CATALOG_CONFIG.SHEET_MX,      CATALOG_CONFIG.LOCAL_MX),
    resolveUrl("usa.csv",     CATALOG_CONFIG.SHEET_USA,      CATALOG_CONFIG.LOCAL_USA),
    resolveUrl("chn.csv",     CATALOG_CONFIG.SHEET_CHN,      CATALOG_CONFIG.LOCAL_CHN),
    resolveUrl("banner.xlsx", CATALOG_CONFIG.SHEET_BANNER,   CATALOG_CONFIG.LOCAL_BANNER),
    resolveUrl("sourcing.xlsx",CATALOG_CONFIG.SHEET_SOURCING, CATALOG_CONFIG.LOCAL_SOURCING),
  ]);

  const [dataMX, dataUSA, dataCHN, dataBanner, dataSourcing] =
    await Promise.allSettled(urls.map(fetchText));

  const mx       = dataMX.status       === "fulfilled" ? parsearSheet(dataMX.value,  "MX")  : [];
  const usa      = dataUSA.status      === "fulfilled" ? parsearSheet(dataUSA.value, "USA") : [];
  const nfg      = dataCHN.status      === "fulfilled" ? parsearSheet(dataCHN.value, "CHN") : [];
  const banner   = dataBanner.status   === "fulfilled" ? parsearBannerPricelist(dataBanner.value) : [];
  const sourcing = dataSourcing.status === "fulfilled" ? parsearSourcing(dataSourcing.value) : new Map();

  return mergear(mx, usa, banner, nfg, sourcing);
}

export const DEMO_PRODUCTOS = [
  { pn: "S18-2VP6D",     marca: "BANNER",    categoria: "Sensores fotoeléctricos",          familia: "S18-2",        desc: "Sensor fotoeléctrico",           precioUSD: 286,  stockMX: 12,  stockUSA: 0,  stockCHN: 0,  leadTimeBanner: 35, sourcingJun: "USA to MTY" },
  { pn: "QS18VP6D",      marca: "BANNER",    categoria: "Sensores fotoeléctricos",          familia: "QS18",         desc: "Sensor fotoeléctrico miniatura",  precioUSD: 342,  stockMX: 5,   stockUSA: 8,  stockCHN: 0,  leadTimeBanner: 35, sourcingJun: "USA to MTY" },
  { pn: "T30UX",         marca: "BANNER",    categoria: "Sensores de medición avanzada",    familia: "T30UX",        desc: "Sensor de ultrasonido",           precioUSD: 0,    stockMX: 0,   stockUSA: 14, stockCHN: 0,  leadTimeBanner: 30, sourcingJun: "SLP to MTY" },
  { pn: "EZ-SCREEN-LS2", marca: "BANNER",    categoria: "Seguridad industrial",             familia: "EZ SCREEN LS", desc: "Cortina de seguridad",            precioUSD: 0,    stockMX: 2,   stockUSA: 6,  stockCHN: 0,  leadTimeBanner: 25, sourcingJun: "SLP to MTY" },
  { pn: "K50L2XGRY",     marca: "BANNER",    categoria: "Indicadores y luces industriales", familia: "K50",          desc: "Torre de señalización LED",       precioUSD: 0,    stockMX: 0,   stockUSA: 0,  stockCHN: 20, leadTimeBanner: 35, sourcingJun: "CHN to MTY" },
  { pn: "TM221C16R",     marca: "SCHNEIDER", cat: "PLCs",         desc: "PLC Modicon M221",              precioUSD: 0,    stockMX: 3,   stockUSA: 0,  stockCHN: 0,  sourcingJun: null },
  { pn: "ATV312H037M2",  marca: "SCHNEIDER", cat: "Variadores",   desc: "Variador de velocidad ATV312",  precioUSD: 0,    stockMX: 4,   stockUSA: 10, stockCHN: 0,  sourcingJun: null },
  { pn: "LRD08",         marca: "SCHNEIDER", cat: "Protección",   desc: "Relé térmico",                  precioUSD: 0,    stockMX: 15,  stockUSA: 0,  stockCHN: 0,  sourcingJun: null },
  { pn: "BI2-M12-AP6X",  marca: "TURCK",     cat: "Sensores",     desc: "Sensor inductivo M12",          precioUSD: 0,    stockMX: 8,   stockUSA: 0,  stockCHN: 0,  sourcingJun: null },
  { pn: "TBEN-S2-4DXP",  marca: "TURCK",     cat: "I/O Remoto",   desc: "Módulo I/O IP67",               precioUSD: 0,    stockMX: 5,   stockUSA: 12, stockCHN: 0,  sourcingJun: null },
  { pn: "280-101",       marca: "WAGO",      cat: "Terminales",   desc: "Terminal feedthrough",          precioUSD: 0,    stockMX: 200, stockUSA: 0,  stockCHN: 0,  sourcingJun: null },
  { pn: "750-841",       marca: "WAGO",      cat: "Controladores",desc: "Controlador WAGO 750",          precioUSD: 0,    stockMX: 1,   stockUSA: 4,  stockCHN: 0,  sourcingJun: null },
  { pn: "787-1004",      marca: "WAGO",      cat: "Fuentes",      desc: "Fuente EPSITRON",               precioUSD: 0,    stockMX: 7,   stockUSA: 0,  stockCHN: 0,  sourcingJun: null },
  { pn: "221-412",       marca: "WAGO",      cat: "Conectores",   desc: "Conector push-in 2 hilos",      precioUSD: 0,    stockMX: 500, stockUSA: 0,  stockCHN: 0,  sourcingJun: null },
];
