"use client";

import { useState, useEffect, useRef } from "react";
import toast, { Toaster } from "react-hot-toast";

const FILE_SLOTS = [
  { key: "mx",       label: "MX — Almacén México",     emoji: "🇲🇽", hint: "TFG - Inventario General" },
  { key: "usa",      label: "USA — Almacén Estados Unidos", emoji: "🇺🇸", hint: "MFG - Inventario General" },
  { key: "chn",      label: "CHN — Almacén China",     emoji: "🇨🇳", hint: "NFG - Inventario General" },
  { key: "banner",   label: "Banner Pricelist",         emoji: "🏷️",  hint: "banner_pricelist_download_…" },
  { key: "sourcing", label: "Sourcing Routes",          emoji: "🗺️",  hint: "Sourcing Item …" },
];

function formatDate(dateStr) {
  if (!dateStr) return "Nunca subido";
  return new Date(dateStr).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function UploadCard({ slot, info, busy, onFile }) {
  const inputRef = useRef();

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) onFile(file);
  }

  return (
    <label
      className={`card bg-base-100 shadow-sm cursor-pointer border-2 border-dashed transition-colors select-none
        ${busy ? "border-primary opacity-60 pointer-events-none" : "border-base-300 active:border-primary"}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.txt"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <div className="card-body p-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl flex-shrink-0">{slot.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight">{slot.label}</p>
            <p className="text-xs text-base-content/40 truncate mt-0.5">{slot.hint}</p>
            <p className={`text-xs mt-1 font-medium ${info ? "text-success" : "text-base-content/30"}`}>
              {info ? `✓ ${formatDate(info.uploadedAt)}` : "Sin archivo"}
            </p>
          </div>
          {busy ? (
            <span className="loading loading-spinner loading-md text-primary flex-shrink-0" />
          ) : (
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </label>
  );
}

export default function UploadPage() {
  const [status, setStatus] = useState({});
  const [uploading, setUploading] = useState({});
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    fetch("/api/admin/upload/status")
      .then((r) => r.json())
      .then((data) => { setStatus(data); setLoadingStatus(false); })
      .catch(() => setLoadingStatus(false));
  }, []);

  async function handleFile(key, file) {
    if (!file) return;
    setUploading((u) => ({ ...u, [key]: true }));

    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", key);

    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al subir");
      toast.success(`✅ ${key.toUpperCase()} actualizado`);
      setStatus((s) => ({ ...s, [key]: { uploadedAt: data.uploadedAt, pathname: data.pathname } }));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUploading((u) => ({ ...u, [key]: false }));
    }
  }

  const totalSubidos = Object.values(status).filter(Boolean).length;

  return (
    <main className="min-h-screen bg-base-200">
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />

      {/* Header */}
      <div className="bg-base-100 border-b border-base-300 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">📂 Actualizar Catálogo</h1>
            <p className="text-xs text-base-content/50">
              {loadingStatus ? "Cargando..." : `${totalSubidos}/5 archivos cargados`}
            </p>
          </div>
          {totalSubidos === 5 && (
            <span className="badge badge-success badge-sm">Todo al día ✓</span>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="max-w-lg mx-auto p-4 grid gap-3">
        <p className="text-xs text-base-content/40 text-center">
          Toca una tarjeta para seleccionar el archivo
        </p>

        {FILE_SLOTS.map((slot) => (
          <UploadCard
            key={slot.key}
            slot={slot}
            info={status[slot.key]}
            busy={uploading[slot.key]}
            onFile={(f) => handleFile(slot.key, f)}
          />
        ))}

        <p className="text-xs text-center text-base-content/30 mt-2">
          Formatos aceptados: .xlsx .xls .csv .txt
        </p>
      </div>
    </main>
  );
}
