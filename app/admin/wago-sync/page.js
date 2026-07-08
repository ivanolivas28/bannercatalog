"use client";
import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function WagoSyncPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [done, setDone] = useState(false);
  const [totales, setTotales] = useState({ updated: 0, notFound: 0, errors: 0 });
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichMsg, setEnrichMsg] = useState(null);
  const fileRef = useRef(null);
  const enrichRef = useRef(null);

  if (!session?.user?.isAdmin) {
    return <div className="p-8 text-error">No autorizado</div>;
  }

  const addLog = (msg, type = "info") => {
    setLog((l) => [...l, { msg, type, ts: new Date().toLocaleTimeString("es-MX") }]);
  };

  const runBatch = async () => {
    setRunning(true);
    setLog([]);
    setDone(false);
    setTotales({ updated: 0, notFound: 0, errors: 0 });

    let offset = 0;
    const limit = 20;
    let totalProductos = null;
    const allItems = [];

    addLog("Iniciando sincronización WAGO…");

    while (true) {
      addLog(`Procesando lote offset=${offset}…`);
      try {
        const res = await fetch(`/api/admin/wago-batch?offset=${offset}&limit=${limit}`);
        const data = await res.json();

        if (!res.ok) {
          addLog(`Error: ${data.error}`, "error");
          break;
        }

        if (totalProductos === null) totalProductos = data.totalProductos;
        if (data.items?.length) allItems.push(...data.items);

        setTotales((t) => ({
          updated:  t.updated  + (data.updated  || 0),
          notFound: t.notFound + (data.notFound || 0),
          errors:   t.errors   + (data.errors   || 0),
        }));

        const pct = Math.round(((offset + limit) / totalProductos) * 100);
        addLog(
          `Lote ${offset}–${offset + limit} de ${totalProductos}: ` +
          `✓ ${data.updated} actualizados, ✗ ${data.notFound} no encontrados, ⚠ ${data.errors} errores (${Math.min(pct, 100)}%)`,
          data.errors > 0 ? "warn" : "ok"
        );

        if (data.done || !data.nextOffset) {
          addLog(`Guardando ${allItems.length} productos en catálogo…`);
          try {
            const fd = new FormData();
            fd.append("items", JSON.stringify(allItems));
            const saveRes = await fetch("/api/admin/wago-json?action=bulk-update", { method: "POST", body: fd });
            const saveData = await saveRes.json();
            if (saveRes.ok) {
              addLog(`✅ Sincronización completa. Catálogo con ${saveData.total} productos totales.`, "ok");
            } else {
              addLog(`⚠ Odoo actualizado pero error al guardar catálogo: ${saveData.error}`, "warn");
            }
          } catch (saveErr) {
            addLog(`⚠ Error al guardar catálogo: ${saveErr.message}`, "warn");
          }
          setDone(true);
          break;
        }

        offset = data.nextOffset;
        await new Promise((r) => setTimeout(r, 1500));
      } catch (err) {
        addLog(`Error de red: ${err.message}`, "error");
        break;
      }
    }

    setRunning(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="btn btn-ghost btn-sm">
          ← Volver
        </button>
        <div>
          <h1 className="text-xl font-bold">Sincronización WAGO</h1>
          <p className="text-sm text-base-content/50">Sincroniza stock, precios y tiempos de entrega WAGO desde wagopro.com</p>
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={runBatch}
            disabled={running}
            className="btn btn-primary gap-2"
          >
            {running ? <span className="loading loading-spinner loading-sm" /> : <i className="ti ti-refresh" />}
            {running ? "Sincronizando…" : "Iniciar sincronización"}
          </button>
          {done && (
            <div className="flex gap-4 text-sm">
              <span className="text-success font-bold">✓ {totales.updated} actualizados</span>
              <span className="text-warning">✗ {totales.notFound} no encontrados</span>
              {totales.errors > 0 && <span className="text-error">⚠ {totales.errors} errores</span>}
            </div>
          )}
        </div>
        <p className="text-xs text-base-content/40">
          Procesa ~20 productos cada 40s. Actualiza stock, precio venta (costo/0.80) y guarda en catálogo. ~345 productos = ~8 min.
        </p>
      </div>

      {/* JSON manual editor section */}
      <div className="card bg-base-100 border border-base-300 shadow-sm p-6 mb-6">
        <h2 className="font-semibold mb-1">Editar wago-stock.json</h2>
        <p className="text-xs text-base-content/50 mb-4">
          Descarga el JSON, añade campos <code>imagen</code> y <code>spu</code> por PN, y vuelve a subir.
          Los campos auto-sync (stock, precio, desc, categoria) se preservan en la próxima sincronización.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="/api/admin/wago-json?action=download"
            download="wago-stock.json"
            className="btn btn-outline btn-sm gap-2"
          >
            <i className="ti ti-download" /> Descargar JSON
          </a>
          <label className="btn btn-outline btn-sm gap-2 cursor-pointer">
            <i className="ti ti-upload" /> Subir JSON
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                setUploadMsg(null);
                try {
                  const text = await file.text();
                  JSON.parse(text); // validate
                  const fd = new FormData();
                  fd.append("file", file);
                  const res = await fetch("/api/admin/wago-json?action=upload", { method: "POST", body: fd });
                  const data = await res.json();
                  setUploadMsg(res.ok ? { ok: true, msg: `✅ Guardado: ${data.count} productos` } : { ok: false, msg: `Error: ${data.error}` });
                } catch (err) {
                  setUploadMsg({ ok: false, msg: `JSON inválido: ${err.message}` });
                } finally {
                  setUploading(false);
                  if (fileRef.current) fileRef.current.value = "";
                }
              }}
            />
          </label>
          {uploading && <span className="loading loading-spinner loading-sm self-center" />}
          {uploadMsg && (
            <span className={`text-sm self-center ${uploadMsg.ok ? "text-success" : "text-error"}`}>
              {uploadMsg.msg}
            </span>
          )}
        </div>
      </div>

      {/* Enrich with image/SPU from wago-enrich.json */}
      <div className="card bg-base-100 border border-base-300 shadow-sm p-6 mb-6">
        <h2 className="font-semibold mb-1">Aplicar enriquecimiento (imagen + SPU)</h2>
        <p className="text-xs text-base-content/50 mb-3">
          Sube el archivo <code>scripts/wago-enrich.json</code> generado por el script de Node.js.
          Solo actualiza los campos <code>imagen</code> y <code>spu</code> — no toca stock, precios ni descripciones.
        </p>
        <div className="flex flex-wrap gap-3">
          <label className="btn btn-primary btn-sm gap-2 cursor-pointer">
            <i className="ti ti-photo-up" /> Subir wago-enrich.json
            <input ref={enrichRef} type="file" accept=".json,application/json" className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setEnriching(true); setEnrichMsg(null);
                try {
                  JSON.parse(await file.text());
                  const fd = new FormData(); fd.append("file", file);
                  const res = await fetch("/api/admin/wago-json?action=enrich", { method: "POST", body: fd });
                  const data = await res.json();
                  setEnrichMsg(res.ok ? { ok: true, msg: `✅ ${data.enriched} productos enriquecidos de ${data.total}` } : { ok: false, msg: `Error: ${data.error}` });
                } catch (err) { setEnrichMsg({ ok: false, msg: `JSON inválido: ${err.message}` }); }
                finally { setEnriching(false); if (enrichRef.current) enrichRef.current.value = ""; }
              }}
            />
          </label>
          {enriching && <span className="loading loading-spinner loading-sm self-center" />}
          {enrichMsg && <span className={`text-sm self-center ${enrichMsg.ok ? "text-success" : "text-error"}`}>{enrichMsg.msg}</span>}
        </div>
        <div className="mt-3 p-3 bg-base-200 rounded text-xs font-mono text-base-content/60">
          <div className="font-semibold mb-1">Cómo generar el archivo:</div>
          <div>cd C:\Users\cask1\Documents\shipearapido</div>
          <div>npm install puppeteer-core</div>
          <div>node scripts/scrape-wago-images.js</div>
        </div>
      </div>

      {log.length > 0 && (
        <div className="bg-neutral rounded-lg p-4 font-mono text-xs text-neutral-content max-h-96 overflow-y-auto">
          {log.map((l, i) => (
            <div key={i} className={
              l.type === "error" ? "text-error" :
              l.type === "warn"  ? "text-warning" :
              l.type === "ok"    ? "text-success" :
              "text-neutral-content/70"
            }>
              <span className="opacity-40">[{l.ts}]</span> {l.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
