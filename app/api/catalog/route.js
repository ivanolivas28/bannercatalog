import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join } from "path";
import { list } from "@vercel/blob";
import * as XLSX from "xlsx";
import {
  parsearSheet,
  parsearBannerPricelist,
  parsearSourcing,
  parsearRemate,
  mergear,
  CATALOG_CONFIG,
  wagoFamilia,
  wagoCategoria,
} from "@/libs/catalog-utils";

export const dynamic = "force-dynamic";

async function fetchXlsxAsCsv(url) {
  const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store", next: { revalidate: 0 } });
  if (!res.ok) return "";
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_csv(ws);
}

async function cargarLocal() {
  const dir = join(process.cwd(), "public", "data");
  const [resMX, resUSA, resCHN, resBanner, resSourcing] = await Promise.allSettled([
    readFile(join(dir, "TFG - Inventario General (1).csv"), "utf-8"),
    readFile(join(dir, "MFG - Inventario General.csv"), "utf-8"),
    readFile(join(dir, "NFG - Inventario General.csv"), "utf-8"),
    readFile(join(dir, "banner_pricelist_download_20260505.txt"), "utf-8"),
    readFile(join(dir, "Sourcing Item Jun 26.csv"), "utf-8"),
  ]);
  return [
    resMX.status       === "fulfilled" ? resMX.value       : "",
    resUSA.status      === "fulfilled" ? resUSA.value      : "",
    resCHN.status      === "fulfilled" ? resCHN.value      : "",
    resBanner.status   === "fulfilled" ? resBanner.value   : "",
    resSourcing.status === "fulfilled" ? resSourcing.value : "",
  ];
}

async function cargarRemoto() {
  const fetchText = (url) =>
    fetch(url, { next: { revalidate: 3600 } }).then((r) =>
      r.ok ? r.text() : ""
    );
  const [resMX, resUSA, resCHN, resBanner, resSourcing] = await Promise.allSettled([
    fetchText(CATALOG_CONFIG.SHEET_MX),
    fetchText(CATALOG_CONFIG.SHEET_USA),
    fetchText(CATALOG_CONFIG.SHEET_CHN),
    fetchText(CATALOG_CONFIG.SHEET_BANNER),
    fetchText(CATALOG_CONFIG.SHEET_SOURCING),
  ]);
  return [
    resMX.status       === "fulfilled" ? resMX.value       : "",
    resUSA.status      === "fulfilled" ? resUSA.value      : "",
    resCHN.status      === "fulfilled" ? resCHN.value      : "",
    resBanner.status   === "fulfilled" ? resBanner.value   : "",
    resSourcing.status === "fulfilled" ? resSourcing.value : "",
  ];
}

export async function GET() {
  try {
    const isLocal = process.env.NODE_ENV === "development";
    const tieneBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
    const base = process.env.NEXTAUTH_URL || "https://tienda.eqkor.mx";

    // Append timestamp to bust Vercel's Data Cache on outgoing fetches
    const bust = `?t=${Date.now()}`;
    const fetchText = (url) =>
      fetch(url + bust, { cache: "no-store", next: { revalidate: 0 } }).then((r) => r.ok ? r.text() : "");

    const blobUrl = (file) => `${base}/api/admin/blob-proxy?file=${file}`;

    let mxTxt, usaTxt, chnTxt, bannerTxt, sourcingTxt;

    let remateTxt = "";
    let wagoStockMap = new Map();

    if (isLocal) {
      [mxTxt, usaTxt, chnTxt, bannerTxt, sourcingTxt] = await cargarLocal().then(r => r);
    } else {
      // Leer desde cPanel primero; si Blob está disponible también carga wago-stock y remate de ahí
      const [mxR, usaR, chnR, bannerR, sourcingR, remateR, wagoR] = await Promise.all([
        fetchText(CATALOG_CONFIG.SHEET_MX),
        fetchText(CATALOG_CONFIG.SHEET_USA),
        fetchText(CATALOG_CONFIG.SHEET_CHN),
        fetchText(CATALOG_CONFIG.SHEET_BANNER),
        fetchText(CATALOG_CONFIG.SHEET_SOURCING),
        fetchXlsxAsCsv(CATALOG_CONFIG.CPANEL_REMATE).catch(() => ""),
        fetchText(`${CATALOG_CONFIG.CPANEL_BASE}/wago-stock.json`).catch(() => ""),
      ]);
      [mxTxt, usaTxt, chnTxt, bannerTxt, sourcingTxt, remateTxt] = [mxR, usaR, chnR, bannerR, sourcingR, remateR];
      if (wagoR) {
        try {
          const wagoJson = JSON.parse(wagoR);
          wagoStockMap = new Map(Object.entries(wagoJson).map(([pn, v]) => [pn.toUpperCase(), v]));
        } catch (_) {}
      }
    }

    const mx       = mxTxt       ? parsearSheet(mxTxt, "MX")        : [];
    const usa      = usaTxt      ? parsearSheet(usaTxt, "USA")       : [];
    const nfg      = chnTxt      ? parsearSheet(chnTxt, "CHN")       : [];
    const banner   = bannerTxt   ? parsearBannerPricelist(bannerTxt) : [];
    const sourcing = sourcingTxt ? parsearSourcing(sourcingTxt)      : new Map();
    const remate   = remateTxt   ? parsearRemate(remateTxt)          : new Map();

    const todos = mergear(mx, usa, banner, nfg, sourcing);

    // Banner lookup map — used for remate products to find the original list price
    const bannerMap = new Map(banner.map((b) => [b.pn?.toUpperCase(), b]));

    // Build set of PNs already in catalog
    const pnsEnCatalogo = new Set(todos.map((p) => p.pn?.toUpperCase()));

    // Return only fields the client uses (reduces JSON payload size)
    const productos = todos.map(({
      pn, desc, marca, familia, categoria,
      precioUSD, netPrice, multiplier, stockMX, stockUSA, stockCHN,
      leadTimeBanner, imagen, urlProducto, sourcingJun,
    }) => {
      const oferta = remate.get(pn?.toUpperCase());
      const wagoData = wagoStockMap.get(pn?.toUpperCase());

      // Enrich WAGO products — always set familia/categoria; add blob data if available
      const esWagoMarca = marca === "WAGO";
      const wagoEnrich = wagoData ? {
        stockWago: wagoData.stock ?? 0,
        precioUSD: wagoData.precioVenta || precioUSD,
        marca: "WAGO",
        desc: wagoData.desc || desc,
        familia: wagoFamilia(pn),
        categoria: wagoCategoria(wagoData.categoria),
        ...(wagoData.imagen ? { imagen: wagoData.imagen } : {}),
        ...(wagoData.spu    ? { spu: wagoData.spu }       : {}),
      } : esWagoMarca ? {
        familia: wagoFamilia(pn),
        categoria: "Conectividad WAGO",
      } : {};

      if (!oferta) {
        return { pn, desc, marca, familia, categoria, precioUSD, netPrice, multiplier, stockMX, stockUSA, stockCHN, leadTimeBanner, imagen, urlProducto, sourcingJun, ...wagoEnrich };
      }
      // precioListPrice (tachado): explicit lista column > Banner pricelist > merged precioUSD
      const bannerEntry = bannerMap.get(pn?.toUpperCase());
      const precioListPrice = oferta.precioLista || bannerEntry?.precioUSD || precioUSD;
      return {
        pn, desc, marca, familia, categoria,
        precioUSD, netPrice, multiplier, stockMX, stockUSA, stockCHN,
        leadTimeBanner, imagen, urlProducto, sourcingJun,
        esRemate: true,
        precioContado: oferta.precioRemate,
        precioCredito: oferta.precioCredito || 0,
        precioListPrice,
        cantidadRemate: oferta.cantidad || 0,
      };
    });

    // Add remate-only products (not in main catalog), enriched with Banner pricelist data
    for (const [pn, oferta] of remate.entries()) {
      if (!pnsEnCatalogo.has(pn)) {
        const b = bannerMap.get(pn) || {};
        const bannerPrice = b.precioUSD || 0;
        const precioListPrice = oferta.precioLista || bannerPrice;
        productos.push({
          pn,
          desc: b.desc || oferta.desc || pn,
          marca: "BANNER",
          familia: b.familia || "",
          categoria: b.categoria || "",
          precioUSD: bannerPrice,
          stockMX: oferta.cantidad || 0,
          stockUSA: 0,
          stockCHN: 0,
          leadTimeBanner: b.leadTimeBanner || 0,
          imagen: b.imagen || null,
          urlProducto: b.urlProducto || null,
          sourcingJun: null,
          esRemate: true,
          precioContado: oferta.precioRemate,
          precioCredito: oferta.precioCredito || 0,
          precioListPrice,
          cantidadRemate: oferta.cantidad || 0,
        });
      }
    }

    // Add WAGO-only products (in wagopro but not in any stock CSV)
    for (const [pn, w] of wagoStockMap.entries()) {
      if (!pnsEnCatalogo.has(pn)) {
        productos.push({
          pn,
          desc: w.desc || pn,
          marca: "WAGO",
          familia: wagoFamilia(pn),
          categoria: wagoCategoria(w.categoria),
          precioUSD: w.precioVenta || 0,
          stockMX: 0,
          stockUSA: 0,
          stockCHN: 0,
          stockWago: w.stock ?? 0,
          leadTimeBanner: 0,
          imagen: w.imagen || null,
          urlProducto: w.urlProducto || null,
          spu: w.spu || null,
          sourcingJun: null,
        });
      }
    }

    // Get last upload date of MX stock file
    let stockUpdatedAt = null;
    try {
      if (tieneBlob) {
        const { blobs } = await list({ prefix: "catalog/mx" });
        const mx = blobs.find((b) => b.pathname.startsWith("catalog/mx"));
        if (mx?.uploadedAt) stockUpdatedAt = mx.uploadedAt;
      } else if (isLocal) {
        const s = await stat(join(process.cwd(), "public", "data", "TFG - Inventario General (1).csv"));
        stockUpdatedAt = s.mtime;
      }
    } catch {}

    return NextResponse.json({ productos, stockUpdatedAt }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (err) {
    console.error("[/api/catalog]", err.message);
    return NextResponse.json([]);
  }
}
