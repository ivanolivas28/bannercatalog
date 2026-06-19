import * as XLSX from "xlsx";

export function exportarCotizacionXLSX(items) {
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

  const filas = [
    [empresa, "", "", "", "", ""],
    [`Cotización  ·  ${fecha}`, "", "", "", "", ""],
    ["", "", "", "", "", ""],
    ["CANT.", "PARTE (N/P)", "DESCRIPCIÓN", "MARCA", "P. UNIT. USD", "TOTAL USD"],
    ...items.map((i) => [
      i.qty,
      i.pn,
      i.desc || i.pn,
      i.marca || "",
      i.precioUSD > 0 ? i.precioUSD : "Cotizar",
      i.precioUSD > 0 ? fmt(i.qty * i.precioUSD) : "Cotizar",
    ]),
    ["", "", "", "", "", ""],
    ["", "", "", "", "SUBTOTAL USD:", subtotal > 0 ? fmt(subtotal) : "—"],
    ["", "", "", "", "IVA 16%:", iva > 0 ? fmt(iva) : "—"],
    ["", "", "", "", "TOTAL USD:", total > 0 ? fmt(total) : "—"],
    ["", "", "", "", "", ""],
    [
      "* Precios en USD antes de IVA. 'Cotizar' = precio bajo consulta. Vigencia: 48 h.",
      "", "", "", "", "",
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(filas);

  ws["!cols"] = [
    { wch: 8 },
    { wch: 24 },
    { wch: 50 },
    { wch: 12 },
    { wch: 18 },
    { wch: 16 },
  ];

  // Bold header row (row index 3 = 0-based)
  const headerRow = 3;
  ["A", "B", "C", "D", "E", "F"].forEach((col) => {
    const cell = ws[`${col}${headerRow + 1}`];
    if (cell) cell.s = { font: { bold: true } };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cotizacion");

  const buf  = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `cotizacion_mvp_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
