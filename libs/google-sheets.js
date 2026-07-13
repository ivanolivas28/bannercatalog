import { google } from "googleapis";

/**
 * Google Sheets integration for Odoo Sales Tracker
 *
 * Handles:
 * - Creating/updating Google Sheets in Drive
 * - Writing customer and sales order data
 * - Providing context for Claude analysis
 */

let authClient = null;

function getAuthClient() {
  if (authClient) return authClient;

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "{}");

    authClient = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
      ],
    });

    return authClient;
  } catch (err) {
    throw new Error(`Google auth error: ${err.message}`);
  }
}

async function getSheetsClient() {
  const auth = getAuthClient();
  return google.sheets({ version: "v4", auth });
}

async function getDriveClient() {
  const auth = getAuthClient();
  return google.drive({ version: "v3", auth });
}

/**
 * Create or get existing Google Sheet
 */
export async function createOrGetSheet(title) {
  const drive = await getDriveClient();
  const sheets = await getSheetsClient();

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID not set in environment");
  }

  // Search for existing sheet with this title in the folder
  try {
    const response = await drive.files.list({
      q: `name="${title}" and mimeType="application/vnd.google-apps.spreadsheet" and "${folderId}" in parents and trashed=false`,
      spaces: "drive",
      fields: "files(id, name, webViewLink)",
      pageSize: 1,
    });

    if (response.data.files && response.data.files.length > 0) {
      return {
        id: response.data.files[0].id,
        name: response.data.files[0].name,
        url: response.data.files[0].webViewLink,
        created: false,
      };
    }
  } catch (err) {
    console.error("[GOOGLE SHEETS] Error searching for existing sheet:", err.message);
  }

  // Create new sheet
  try {
    const createRes = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: title,
          locale: "es_MX",
          timeZone: "America/Monterrey",
        },
        sheets: [
          {
            properties: { sheetId: 0, title: "Contactos" },
          },
          {
            properties: { sheetId: 1, title: "Órdenes" },
          },
          {
            properties: { sheetId: 2, title: "Cotizaciones" },
          },
          {
            properties: { sheetId: 3, title: "Contexto" },
          },
        ],
      },
    });

    const spreadsheetId = createRes.data.spreadsheetId;

    // Move to folder
    await drive.files.update({
      fileId: spreadsheetId,
      addParents: folderId,
      removeParents: "root",
      fields: "id, parents, webViewLink",
    });

    const fileRes = await drive.files.get({
      fileId: spreadsheetId,
      fields: "id, name, webViewLink",
    });

    return {
      id: spreadsheetId,
      name: fileRes.data.name,
      url: fileRes.data.webViewLink,
      created: true,
    };
  } catch (err) {
    throw new Error(`Failed to create Google Sheet: ${err.message}`);
  }
}

/**
 * Write contacts data to sheet
 */
export async function writeContactsToSheet(spreadsheetId, contacts) {
  const sheets = await getSheetsClient();

  if (!contacts || contacts.length === 0) {
    console.warn("[GOOGLE SHEETS] No contacts to write");
    return;
  }

  // Prepare header
  const headers = [
    "ID",
    "Nombre",
    "Email",
    "Teléfono",
    "Móvil",
    "Ciudad",
    "Empresa",
    "Tipo Cliente",
    "Fecha Creación",
    "Última Actualización",
  ];

  // Prepare rows
  const rows = contacts.map((c) => [
    c.id || "",
    c.name || "",
    c.email || "",
    c.phone || "",
    c.mobile || "",
    c.city || "",
    c.parent_id ? (Array.isArray(c.parent_id) ? c.parent_id[1] : "N/A") : "",
    c.customer_rank > 0 ? "Cliente" : c.supplier_rank > 0 ? "Proveedor" : "Contacto",
    c.create_date ? new Date(c.create_date).toLocaleDateString("es-MX") : "",
    c.write_date ? new Date(c.write_date).toLocaleDateString("es-MX") : "",
  ]);

  const values = [headers, ...rows];

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Contactos!A1",
      valueInputOption: "RAW",
      requestBody: { values },
    });

    // Format header row
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.2, blue: 0.8 },
                  textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
                  horizontalAlignment: "CENTER",
                },
              },
              fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
            },
          },
          {
            autoResizeDimensions: {
              dimensions: { sheetId: 0, dimension: "COLUMNS" },
            },
          },
        ],
      },
    });

    console.log(`[GOOGLE SHEETS] Wrote ${contacts.length} contacts to sheet`);
  } catch (err) {
    throw new Error(`Failed to write contacts: ${err.message}`);
  }
}

/**
 * Write sales orders/quotations to sheet
 */
export async function writeSalesOrdersToSheet(spreadsheetId, orders, sheetTitle = "Órdenes") {
  const sheets = await getSheetsClient();

  if (!orders || orders.length === 0) {
    console.warn(`[GOOGLE SHEETS] No orders to write to ${sheetTitle}`);
    return;
  }

  // Determine if this is quotations or orders based on sheetTitle
  const isQuotation = sheetTitle.includes("Cotización");

  // Prepare header
  const headers = [
    "ID",
    "Número",
    "Cliente",
    "Fecha",
    isQuotation ? "Fecha Vigencia" : "Fecha Entrega",
    "Monto Total",
    "Moneda",
    "Estado",
    "Días Desde Creación",
    "Días Sin Actualización",
  ];

  const now = new Date();

  // Prepare rows
  const rows = orders.map((o) => {
    const createDate = new Date(o.create_date);
    const writeDate = new Date(o.write_date);
    const daysSinceCreation = Math.floor((now - createDate) / (1000 * 60 * 60 * 24));
    const daysSinceUpdate = Math.floor((now - writeDate) / (1000 * 60 * 60 * 24));

    return [
      o.id || "",
      o.name || "",
      o.partner_id ? (Array.isArray(o.partner_id) ? o.partner_id[1] : o.partner_id) : "",
      o.date_order ? new Date(o.date_order).toLocaleDateString("es-MX") : "",
      isQuotation && o.validity_date
        ? new Date(o.validity_date).toLocaleDateString("es-MX")
        : "",
      o.amount_total || 0,
      o.currency_id ? (Array.isArray(o.currency_id) ? o.currency_id[1] : "MXN") : "MXN",
      o.state || "",
      daysSinceCreation,
      daysSinceUpdate,
    ];
  });

  const values = [headers, ...rows];

  // Determine sheet ID based on title
  const sheetId = sheetTitle === "Órdenes" ? 1 : 2;

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetTitle}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values },
    });

    // Format header row
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.5, blue: 0.2 },
                  textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
                  horizontalAlignment: "CENTER",
                },
              },
              fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
            },
          },
          {
            autoResizeDimensions: {
              dimensions: { sheetId, dimension: "COLUMNS" },
            },
          },
        ],
      },
    });

    console.log(`[GOOGLE SHEETS] Wrote ${orders.length} ${sheetTitle.toLowerCase()} to sheet`);
  } catch (err) {
    throw new Error(`Failed to write ${sheetTitle.toLowerCase()}: ${err.message}`);
  }
}

/**
 * Write business context to sheet
 */
export async function writeContextToSheet(spreadsheetId, syncData) {
  const sheets = await getSheetsClient();

  const contextInfo = [
    ["Información de Sincronización", ""],
    ["Fecha de Sincronización", new Date().toLocaleString("es-MX")],
    ["Total de Contactos", syncData.contactsCount || 0],
    ["Total de Órdenes (>1k USD)", syncData.ordersCount || 0],
    ["Total de Cotizaciones (>1k USD)", syncData.quotationsCount || 0],
    ["", ""],
    ["Notas para Claude AI", ""],
    [
      "Instrucciones",
      "Este sheet contiene datos de Odoo sincronizados automáticamente. Las columnas incluyen:",
    ],
    ["- Contactos", "Todos los contactos del módulo de contactos de Odoo"],
    ["- Órdenes", "Órdenes de venta confirmadas mayores a 1k USD o 10k MXN"],
    ["- Cotizaciones", "Cotizaciones abiertas mayores a 1k USD o 10k MXN"],
    ["", ""],
    [
      "Próximos Pasos",
      "1. Revisa los contactos y órdenes\n2. Identifica oportunidades de seguimiento\n3. Claude generará estrategias de contacto basadas en este análisis",
    ],
  ];

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Contexto!A1",
      valueInputOption: "RAW",
      requestBody: { values: contextInfo },
    });

    console.log("[GOOGLE SHEETS] Wrote context information");
  } catch (err) {
    throw new Error(`Failed to write context: ${err.message}`);
  }
}
