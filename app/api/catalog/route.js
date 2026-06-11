import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import {
  parsearSheet,
  parsearBannerPricelist,
  parsearSourcing,
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
    const [mxTxt, usaTxt, chnTxt, bannerTxt, sourcingTxt] = isLocal
      ? await cargarLocal()
      : await cargarRemoto();

    const mx       = mxTxt       ? parsearSheet(mxTxt, "MX")             : [];
    const usa      = usaTxt      ? parsearSheet(usaTxt, "USA")            : [];
    const nfg      = chnTxt      ? parsearSheet(chnTxt, "CHN")            : [];
    const banner   = bannerTxt   ? parsearBannerPricelist(bannerTxt)      : [];
    const sourcing = sourcingTxt ? parsearSourcing(sourcingTxt)           : new Map();

    const todos = mergear(mx, usa, banner, nfg, sourcing);

    // Return only fields the client uses (reduces JSON payload size)
    const productos = todos.map(({
      pn, desc, marca, familia, categoria,
      precioUSD, stockMX, stockUSA, stockCHN,
      leadTimeBanner, imagen, urlProducto, sourcingJun,
    }) => ({
      pn, desc, marca, familia, categoria,
      precioUSD, stockMX, stockUSA, stockCHN,
      leadTimeBanner, imagen, urlProducto, sourcingJun,
    }));

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
