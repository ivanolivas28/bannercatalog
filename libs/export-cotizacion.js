import ExcelJS from "exceljs";

const IMG_SIZE = 60; // px — row height and image size

async function fetchImageBase64(url) {
  try {
    const proxyUrl = `/api/img-proxy?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  } catch {
    return null;
  }
}

export async function exportarCotizacionXLSX(items) {
  const empresa = "EQKOR";
  const fecha = new Date().toLocaleDateString("es-MX", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const subtotal = items.reduce(
    (s, i) => s + (i.precioUSD > 0 ? i.qty * i.precioUSD : 0),
    0
  );
  const iva   = subtotal * 0.16;
  const total = subtotal + iva;
  const fmt   = (n) => parseFloat(n.toFixed(2));

  // Pre-fetch all images in parallel
  const imageMap = {};
  await Promise.all(
    items.map(async (i) => {
      if (i.imagen) {
        const b64 = await fetchImageBase64(i.imagen);
        if (b64) imageMap[i.pn] = b64;
      }
    })
  );

  const hasImages = Object.keys(imageMap).length > 0;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Cotizacion");

  // Column widths
  ws.columns = hasImages
    ? [
        { width: 10 },  // A — IMAGEN
        { width: 8 },   // B — CANT.
        { width: 22 },  // C — PARTE
        { width: 46 },  // D — DESCRIPCIÓN
        { width: 12 },  // E — MARCA
        { width: 26 },  // F — TIEMPO ENTREGA
        { width: 16 },  // G — P. UNIT.
        { width: 14 },  // H — TOTAL
      ]
    : [
        { width: 8 },   // A — CANT.
        { width: 22 },  // B — PARTE
        { width: 50 },  // C — DESCRIPCIÓN
        { width: 12 },  // D — MARCA
        { width: 26 },  // E — TIEMPO ENTREGA
        { width: 16 },  // F — P. UNIT.
        { width: 14 },  // G — TOTAL
      ];

  const lastCol = hasImages ? "H" : "G";
  const cols    = hasImages ? 8 : 7;

  // Row 1: empresa
  const r1 = ws.addRow([empresa, ...Array(cols - 1).fill("")]);
  r1.getCell(1).font = { bold: true, size: 14 };

  // Row 2: fecha
  ws.addRow([`Cotización  ·  ${fecha}`, ...Array(cols - 1).fill("")]);

  // Row 3: blank
  ws.addRow([]);

  // Row 4: header
  const headers = hasImages
    ? ["IMAGEN", "CANT.", "PARTE (N/P)", "DESCRIPCIÓN", "MARCA", "TIEMPO ENTREGA", "P. UNIT. USD", "TOTAL USD"]
    : ["CANT.", "PARTE (N/P)", "DESCRIPCIÓN", "MARCA", "TIEMPO ENTREGA", "P. UNIT. USD", "TOTAL USD"];
  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
  });
  headerRow.height = 18;

  // Data rows
  const dataStartRow = 5;
  for (let idx = 0; idx < items.length; idx++) {
    const i = items[idx];
    const rowData = hasImages
      ? ["", i.qty, i.pn, i.desc || i.pn, i.marca || "", i.tiempoEntrega || "", i.precioUSD > 0 ? i.precioUSD : "Cotizar", i.precioUSD > 0 ? fmt(i.qty * i.precioUSD) : "Cotizar"]
      : [i.qty, i.pn, i.desc || i.pn, i.marca || "", i.tiempoEntrega || "", i.precioUSD > 0 ? i.precioUSD : "Cotizar", i.precioUSD > 0 ? fmt(i.qty * i.precioUSD) : "Cotizar"];

    const row = ws.addRow(rowData);
    row.height = hasImages ? IMG_SIZE * 0.75 : 15; // exceljs height is in points (~0.75 of px)

    // Embed image if available
    if (hasImages && imageMap[i.pn]) {
      const imgId = wb.addImage({ base64: imageMap[i.pn], extension: "jpeg" });
      const excelRow = dataStartRow + idx - 1; // 0-based
      ws.addImage(imgId, {
        tl: { col: 0, row: excelRow },
        br: { col: 1, row: excelRow + 1 },
        editAs: "oneCell",
      });
    }
  }

  // Blank row
  ws.addRow([]);

  // Totals
  const addTotal = (label, value) => {
    const row = ws.addRow([...Array(cols - 2).fill(""), label, value]);
    row.getCell(cols - 1).font = { bold: true };
    row.getCell(cols).font = { bold: true };
  };
  addTotal("SUBTOTAL USD:", subtotal > 0 ? fmt(subtotal) : "—");
  addTotal("IVA 16%:", iva > 0 ? fmt(iva) : "—");
  addTotal("TOTAL USD:", total > 0 ? fmt(total) : "—");

  // Footer note
  ws.addRow([]);
  ws.addRow(["* Precios en USD antes de IVA. 'Cotizar' = precio bajo consulta. Vigencia: 48 h."]);

  // Write and download
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = `cotizacion_eqkor_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
