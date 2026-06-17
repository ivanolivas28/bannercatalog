import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import {
  parsearSheet,
  parsearBannerPricelist,
  parsearSourcing,
  parsearRemate,
  mergear,
  CATALOG_CONFIG,
} from "@/libs/catalog-utils";

export const dynamic = "force-dynamic";

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

    const fetchText = (url) =>
      fetch(url, { next: { revalidate: 1800 } }).then((r) => r.ok ? r.text() : "");

    const blobUrl = (file) => `${base}/api/admin/blob-proxy?file=${file}`;

    let mxTxt, usaTxt, chnTxt, bannerTxt, sourcingTxt;

    let remateTxt = "";

    if (isLocal) {
      [mxTxt, usaTxt, chnTxt, bannerTxt, sourcingTxt] = await cargarLocal().then(r => r);
    } else if (tieneBlob) {
      [mxTxt, usaTxt, chnTxt, bannerTxt, sourcingTxt, remateTxt] = await Promise.all([
        fetchText(blobUrl("mx.csv")),
        fetchText(blobUrl("usa.csv")),
        fetchText(blobUrl("chn.csv")),
        fetchText(blobUrl("banner.xlsx")),
        fetchText(blobUrl("sourcing.xlsx")),
        fetchText(blobUrl("remate.xlsx")).catch(() => ""),
      ]);
    } else {
      [mxTxt, usaTxt, chnTxt, bannerTxt, sourcingTxt] = await cargarRemoto().then(r => r);
    }

    const mx       = mxTxt       ? parsearSheet(mxTxt, "MX")        : [];
    const usa      = usaTxt      ? parsearSheet(usaTxt, "USA")       : [];
    const nfg      = chnTxt      ? parsearSheet(chnTxt, "CHN")       : [];
    const banner   = bannerTxt   ? parsearBannerPricelist(bannerTxt) : [];
    const sourcing = sourcingTxt ? parsearSourcing(sourcingTxt)      : new Map();
    const remate   = remateTxt   ? parsearRemate(remateTxt)          : new Map();

    const todos = mergear(mx, usa, banner, nfg, sourcing);

    // Return only fields the client uses (reduces JSON payload size)
    const productos = todos.map(({
      pn, desc, marca, familia, categoria,
      precioUSD, stockMX, stockUSA, stockCHN,
      leadTimeBanner, imagen, urlProducto, sourcingJun,
    }) => {
      const oferta = remate.get(pn?.toUpperCase());
      return {
        pn, desc, marca, familia, categoria,
        precioUSD, stockMX, stockUSA, stockCHN,
        leadTimeBanner, imagen, urlProducto, sourcingJun,
        ...(oferta ? {
          esRemate: true,
          precioRemate: oferta.precioRemate,
          precioOriginal: oferta.precioOriginal || precioUSD,
          cantidadRemate: oferta.cantidad || 0,
        } : {}),
      };
    });

    return NextResponse.json(productos, {
      headers: {
        "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    console.error("[/api/catalog]", err.message);
    return NextResponse.json([]);
  }
}
