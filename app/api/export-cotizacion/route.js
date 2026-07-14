import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const IMG_SIZE_PX = 60;
const IMG_PT = Math.round(IMG_SIZE_PX * 0.75); // Excel row height in points

async function fetchImageBuffer(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; eqkor/1.0)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function POST(req) {
  try {
    const { items } = await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Sin items" }, { status: 400 });
    }

    const fecha = new Date().toLocaleDateString("es-MX", {
      day: "2-digit", month: "long", year: "numeric",
    });
    const fmt = (n) => parseFloat(n.toFixed(2));
    const subtotal = items.reduce((s, i) => s + (i.precioUSD > 0 ? i.qty * i.precioUSD : 0), 0);
    const iva   = subtotal * 0.16;
    const total = subtotal + iva;

    // Fetch all images in parallel
    const imageBuffers = await Promise.all(
      items.map(async (i) => {
        if (!i.imagen) return null;
        return fetchImageBuffer(i.imagen);
      })
    );
    const hasImages = imageBuffers.some((b) => b !== null);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Cotizacion");

    if (hasImages) {
      ws.columns = [
        { width: 10 },  // A — IMAGEN
        { width: 8 },   // B — CANT.
        { width: 22 },  // C — PARTE
        { width: 46 },  // D — DESCRIPCIÓN
        { width: 12 },  // E — MARCA
        { width: 26 },  // F — TIEMPO ENTREGA
        { width: 16 },  // G — P. UNIT. USD
        { width: 14 },  // H — TOTAL USD
      ];
    } else {
      ws.columns = [
        { width: 8 },   // A — CANT.
        { width: 22 },  // B — PARTE
        { width: 50 },  // C — DESCRIPCIÓN
        { width: 12 },  // D — MARCA
        { width: 26 },  // E — TIEMPO ENTREGA
        { width: 16 },  // F — P. UNIT. USD
        { width: 14 },  // G — TOTAL USD
      ];
    }

    const cols = hasImages ? 8 : 7;

    // Row 1 — empresa
    const r1 = ws.addRow(["EQKOR", ...Array(cols - 1).fill("")]);
    r1.getCell(1).font = { bold: true, size: 14 };

    // Row 2 — fecha
    ws.addRow([`Cotización  ·  ${fecha}`, ...Array(cols - 1).fill("")]);

    // Row 3 — blank
    ws.addRow([]);

    // Row 4 — header
    const headers = hasImages
      ? ["IMAGEN", "CANT.", "PARTE (N/P)", "DESCRIPCIÓN", "MARCA", "TIEMPO ENTREGA", "P. UNIT. USD", "TOTAL USD"]
      : ["CANT.", "PARTE (N/P)", "DESCRIPCIÓN", "MARCA", "TIEMPO ENTREGA", "P. UNIT. USD", "TOTAL USD"];
    const headerRow = ws.addRow(headers);
    headerRow.height = 18;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
    });

    // Data rows (start at Excel row 5)
    const dataStartRow = 5;
    for (let idx = 0; idx < items.length; idx++) {
      const i = items[idx];
      const rowData = hasImages
        ? ["", i.qty, i.pn, i.desc || i.pn, i.marca || "", i.tiempoEntrega || "",
           i.precioUSD > 0 ? i.precioUSD : "Cotizar",
           i.precioUSD > 0 ? fmt(i.qty * i.precioUSD) : "Cotizar"]
        : [i.qty, i.pn, i.desc || i.pn, i.marca || "", i.tiempoEntrega || "",
           i.precioUSD > 0 ? i.precioUSD : "Cotizar",
           i.precioUSD > 0 ? fmt(i.qty * i.precioUSD) : "Cotizar"];

      const row = ws.addRow(rowData);
      if (hasImages) row.height = IMG_PT;

      const buf = imageBuffers[idx];
      if (hasImages && buf) {
        const imgId = wb.addImage({ buffer: buf, extension: "jpeg" });
        const excelRow = dataStartRow + idx - 1; // 0-based for tl/br
        ws.addImage(imgId, {
          tl: { col: 0, row: excelRow },
          br: { col: 1, row: excelRow + 1 },
          editAs: "oneCell",
        });
      }
    }

    // Blank + totals
    ws.addRow([]);
    const addTotal = (label, value) => {
      const row = ws.addRow([...Array(cols - 2).fill(""), label, value]);
      row.getCell(cols - 1).font = { bold: true };
      row.getCell(cols).font = { bold: true };
    };
    addTotal("SUBTOTAL USD:", subtotal > 0 ? fmt(subtotal) : "—");
    addTotal("IVA 16%:", iva > 0 ? fmt(iva) : "—");
    addTotal("TOTAL USD:", total > 0 ? fmt(total) : "—");
    ws.addRow([]);
    ws.addRow(["* Precios en USD antes de IVA. 'Cotizar' = precio bajo consulta. Vigencia: 48 h."]);

    const buf = await wb.xlsx.writeBuffer();

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="cotizacion_eqkor_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("[export-cotizacion]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
