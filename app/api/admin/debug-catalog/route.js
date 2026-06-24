import { NextResponse } from "next/server";
import { parsearSheet, parsearBannerPricelist, mergear } from "@/libs/catalog-utils";

export const dynamic = "force-dynamic";

// Helper to fetch a blob file
async function fetchBlob(file) {
  const base = process.env.NEXTAUTH_URL || "https://tienda.eqkor.mx";
  const res = await fetch(`${base}/api/admin/blob-proxy?file=${file}`);
  if (!res.ok) throw new Error(`blob-proxy ${file} HTTP ${res.status}`);
  return res.text();
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "SMB30").toUpperCase();

    const [mxCsv, usaCsv, bannerCsv] = await Promise.all([
      fetchBlob("mx.csv").catch(() => ""),
      fetchBlob("usa.csv").catch(() => ""),
      fetchBlob("banner.xlsx").catch(() => ""),
    ]);

    const mx     = mxCsv     ? parsearSheet(mxCsv, "MX")             : [];
    const usa    = usaCsv    ? parsearSheet(usaCsv, "USA")            : [];
    const banner = bannerCsv ? parsearBannerPricelist(bannerCsv)      : [];

    const todos = mergear(mx, usa, banner);

    const enMX     = mx.filter((p) => p.pn?.toUpperCase().includes(q));
    const enUSA    = usa.filter((p) => p.pn?.toUpperCase().includes(q));
    const enBanner = banner.filter((p) => p.pn?.toUpperCase().includes(q));
    const enMerge  = todos.filter((p) => p.pn?.toUpperCase().includes(q));

    return NextResponse.json({
      query: q,
      mxTotal: mx.length,
      usaTotal: usa.length,
      bannerTotal: banner.length,
      mergeTotal: todos.length,
      enMX,
      enUSA,
      enBanner,
      enMerge,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message });
  }
}
