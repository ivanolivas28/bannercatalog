/**
 * Scrape wago.com search pages for product image URLs and SPU.
 * Uses puppeteer-core + your existing Chrome installation.
 *
 * Usage:
 *   npm install puppeteer-core
 *   node scripts/scrape-wago-images.js
 *
 * Output: scripts/wago-enrich.json  →  upload via /admin/wago-sync
 */

const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

// ── Config ──────────────────────────────────────────────────────────────────

// Adjust this to your Chrome path if needed
const CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Users\\cask1\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe",
];

const WAGO_API_URL = "https://tienda.eqkor.mx/api/admin/wago-json?action=pns";
const OUTPUT_FILE  = path.join(__dirname, "wago-enrich.json");

// ── Helpers ──────────────────────────────────────────────────────────────────

function findChrome() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("Chrome not found. Edit CHROME_PATHS in this script.");
}

async function waitForProduct(page, timeout = 6000) {
  try {
    await page.waitForSelector(".wg-product-list-item img", { timeout });
    return true;
  } catch {
    return false;
  }
}

async function extractProduct(page) {
  return page.evaluate(() => {
    const item = document.querySelector(".wg-product-list-item");
    if (!item) return { imagen: null, spu: null };

    const imgs = [...item.querySelectorAll("img")];
    const img = imgs.find(
      (i) =>
        i.src.includes("medias") &&
        !i.src.includes("QR") &&
        !i.src.includes("0001") &&
        !i.src.includes("Apple") &&
        !i.src.includes("Google")
    );

    const spuEl = [...item.querySelectorAll("*")].find(
      (el) => el.childElementCount === 0 && el.textContent.includes("SPU")
    );
    const spuTxt = spuEl?.textContent?.trim();
    const spuMatch =
      spuTxt?.match(/\((\d+)\)\s*Piece/) ||
      spuTxt?.match(/SPU\):\s*([\d,]+)/);
    const spu = spuMatch ? parseInt(spuMatch[1].replace(/,/g, "")) : null;

    return {
      imagen: img?.src || null,
      spu,
    };
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  // 1. Fetch PN list
  console.log("Fetching PN list from tienda.eqkor.mx...");
  const { default: fetch } = await import("node-fetch").catch(() => {
    // Fallback for Node 18+ built-in fetch
    return { default: globalThis.fetch };
  });

  let pns;
  try {
    const res = await fetch(WAGO_API_URL);
    pns = await res.json();
    console.log(`${pns.length} PNs to scrape.`);
  } catch (err) {
    console.error("Failed to fetch PN list:", err.message);
    process.exit(1);
  }

  // Load existing output if resuming
  let results = {};
  if (fs.existsSync(OUTPUT_FILE)) {
    results = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));
    const alreadyDone = Object.keys(results).length;
    console.log(`Resuming — ${alreadyDone} PNs already done.`);
    pns = pns.filter((pn) => !results[pn]);
    console.log(`${pns.length} PNs remaining.`);
  }

  if (pns.length === 0) {
    console.log("All PNs already scraped!");
    return;
  }

  // 2. Launch Chrome
  const executablePath = findChrome();
  console.log(`Using Chrome: ${executablePath}`);
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Block analytics/ads to speed up loading
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    if (
      url.includes("google") ||
      url.includes("analytics") ||
      url.includes("hubspot") ||
      url.includes("stackadapt") ||
      url.includes("qualtrics") ||
      url.includes("doubleclick") ||
      url.includes("facebook")
    ) {
      req.abort();
    } else {
      req.continue();
    }
  });

  // 3. Scrape each PN
  let done = 0;
  const total = pns.length;

  for (const pn of pns) {
    const url = `https://www.wago.com/us/search?text=${encodeURIComponent(pn)}`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      const found = await waitForProduct(page);

      if (found) {
        const data = await extractProduct(page);
        results[pn] = data;
      } else {
        results[pn] = { imagen: null, spu: null };
      }
    } catch (err) {
      results[pn] = { imagen: null, spu: null };
    }

    done++;
    const pct = Math.round((done / total) * 100);
    process.stdout.write(`\r[${pct}%] ${done}/${total} — ${pn.padEnd(25)} img=${!!results[pn].imagen} spu=${results[pn].spu}`);

    // Save progress every 10 PNs
    if (done % 10 === 0) {
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    }
  }

  // Final save
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  await browser.close();

  const withImg = Object.values(results).filter((r) => r.imagen).length;
  const withSpu = Object.values(results).filter((r) => r.spu).length;
  console.log(`\n\nDone! ${Object.keys(results).length} PNs scraped.`);
  console.log(`  Con imagen: ${withImg}`);
  console.log(`  Con SPU:    ${withSpu}`);
  console.log(`\nArchivo guardado: ${OUTPUT_FILE}`);
  console.log(`\nSube este archivo en /admin/wago-sync → "Aplicar enriquecimiento" (agrega solo imagen/SPU)`);
})();
