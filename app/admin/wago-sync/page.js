"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function WagoSyncPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [done, setDone] = useState(false);
  const [totales, setTotales] = useState({ updated: 0, notFound: 0, errors: 0 });

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
          addLog("✅ Sincronización completa.", "ok");
          setDone(true);
          break;
        }

        offset = data.nextOffset;
        // Small pause between batches
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
          <p className="text-sm text-base-content/50">Actualiza precios de costo desde wagopro.com → Odoo</p>
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
          Procesa ~20 productos cada 40s. Total ~345 productos WAGO = ~12 lotes (~8 min total).
        </p>
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
