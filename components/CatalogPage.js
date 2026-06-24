"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signIn } from "next-auth/react";
import {
  filtrarProductos,
  getEntregaInfo,
  formatPrecioUSD,
  imagenProducto,
  nombreFriendly,
  CATALOG_CONFIG,
  DEMO_PRODUCTOS,
} from "@/libs/catalog-utils";
import { exportarCotizacionXLSX } from "@/libs/export-cotizacion";
import toast from "react-hot-toast";

/* ─── Product image with fallback ─── */
function ProductImage({ p, href }) {
  const [err, setErr] = useState(false);
  const imgUrl = imagenProducto(p);

  const inner = imgUrl && !err ? (
    <img
      src={imgUrl}
      alt={p.desc || p.pn}
      className="w-full h-full object-contain p-3"
      loading="lazy"
      onError={() => setErr(true)}
    />
  ) : (
    <i className="ti ti-cube text-5xl text-base-300" />
  );

  const cls = "h-36 bg-base-200 border-b border-base-300 flex items-center justify-center overflow-hidden flex-shrink-0";

  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${cls} hover:opacity-80 transition-opacity`}
      title="Ver en sitio oficial Banner Engineering"
    >
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/* ─── Cart item inside the quote panel ─── */
function CartItem({ item, session, onUpdateQty, onRemove }) {
  const lineTotal = session && item.precioUSD > 0 ? item.qty * item.precioUSD : null;

  const esCHN = item.sourcingJun === "CHN to MTY";
  const secondaryStock = esCHN ? (item.stockCHN || 0) : (item.stockUSA || 0);
  const secondaryLabel = esCHN ? "China" : "USA";
  const secondaryFlag  = esCHN ? "🇨🇳" : "🇺🇸";

  return (
    <div className="bg-base-200 rounded-xl p-3">
      <div className="flex justify-between items-start gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm font-bold text-base-content truncate">{item.pn}</p>
          <p className="text-[11px] text-base-content/50 leading-snug line-clamp-2 mt-0.5">
            {item.desc || item.pn}
          </p>
        </div>
        <button
          onClick={() => onRemove(item.pn)}
          className="btn btn-ghost btn-xs btn-circle text-base-content/30 hover:text-error flex-shrink-0"
        >
          <i className="ti ti-trash text-sm" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        {/* Qty stepper */}
        <div className="flex items-center border border-base-300 rounded-lg bg-base-100 overflow-hidden">
          <button
            onClick={() => onUpdateQty(item.pn, Math.max(1, item.qty - 1))}
            className="w-7 h-7 flex items-center justify-center text-base-content/50 hover:bg-base-300 text-sm"
          >
            −
          </button>
          <span className="w-9 text-center text-sm font-mono font-bold border-x border-base-300">
            {item.qty}
          </span>
          <button
            onClick={() => onUpdateQty(item.pn, item.qty + 1)}
            className="w-7 h-7 flex items-center justify-center text-base-content/50 hover:bg-base-300 text-sm"
          >
            +
          </button>
        </div>

        {/* Price — only visible when logged in */}
        <div className="text-right">
          {session ? (
            lineTotal !== null ? (
            <>
              <span className="text-[10px] text-base-content/40">
                ${item.precioUSD.toLocaleString("en-US")} c/u ·{" "}
              </span>
              <span className="text-sm font-bold text-base-content">
                ${lineTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </>
          ) : (
            <span className="text-xs text-base-content/40 italic">Precio a cotizar</span>
          )
          ) : (
            <span className="flex items-center gap-1 text-xs text-base-content/40">
              <i className="ti ti-lock text-xs" /> Precio privado
            </span>
          )}
        </div>
      </div>

      {/* Stock mini-indicators — respect sourcing rule */}
      <div className="flex gap-1 mt-2">
        {session ? (
          <>
            {item.stockMX > 0 && (
              <span className="text-[9px] font-semibold text-success bg-success/10 px-1.5 py-0.5 rounded">
                🇲🇽 {item.stockMX} en MX
              </span>
            )}
            {secondaryStock > 0 && (
              <span className="text-[9px] font-semibold text-info bg-info/10 px-1.5 py-0.5 rounded">
                {secondaryFlag} {secondaryStock} en {secondaryLabel}
              </span>
            )}
          </>
        ) : (
          <span className="text-[9px] font-semibold text-base-content/50 bg-base-200 px-1.5 py-0.5 rounded">
            {item.stockMX > 0 && secondaryStock > 0
              ? `Disponible MX & ${secondaryLabel}`
              : item.stockMX > 0
              ? "Disponible en MX"
              : secondaryStock > 0
              ? `Disponible en ${secondaryLabel}`
              : "Sin stock inmediato"}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Quote cart side panel ─── */
function QuoteCartPanel({ items, session, onUpdateQty, onRemove, onExport, onSendOdoo, onClose }) {
  const subtotal = items.reduce(
    (s, i) => s + (i.precioUSD > 0 ? i.qty * i.precioUSD : 0),
    0
  );
  const iva   = subtotal * 0.16;
  const total = subtotal + iva;
  const fmtUSD = (n) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalPiezas        = items.reduce((s, i) => s + i.qty, 0);
  const hayPreciosPendientes = items.some((i) => !i.precioUSD || i.precioUSD <= 0);

  /* ── Guest contact form state ── */
  const [contacto,  setContacto]  = useState({ nombre: "", apellido: "", empresa: "", email: "", telefono: "" });
  const [enviando,  setEnviando]  = useState(false);
  const [enviado,   setEnviado]   = useState(false);
  const [formError, setFormError] = useState("");

  const setField = (k) => (e) => setContacto((p) => ({ ...p, [k]: e.target.value }));

  const solicitarCotizacion = async () => {
    const { nombre, apellido, empresa, email, telefono } = contacto;
    if (!nombre || !apellido || !empresa || !email || !telefono) {
      setFormError("Por favor completa todos los campos.");
      return;
    }
    setFormError("");
    setEnviando(true);
    try {
      const res  = await fetch("/api/cotizacion", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ items, contacto }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar.");
      setEnviado(true);
    } catch (err) {
      setFormError(err.message || "No se pudo enviar. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-base-100 shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-neutral text-neutral-content border-b border-white/10">
          <div>
            <h2 className="font-bold text-base">Mi cotización</h2>
            <p className="text-xs opacity-60">
              {items.length} producto{items.length !== 1 ? "s" : ""} · {totalPiezas} pieza{totalPiezas !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle text-neutral-content">
            <i className="ti ti-x text-lg" />
          </button>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-base-content/30 py-16">
              <i className="ti ti-clipboard-list text-6xl block mb-3 opacity-20" />
              <p className="text-sm">Tu cotización está vacía</p>
              <p className="text-xs mt-1">Agrega productos desde el catálogo</p>
            </div>
          ) : (
            items.map((item) => (
              <CartItem key={item.pn} item={item} session={session} onUpdateQty={onUpdateQty} onRemove={onRemove} />
            ))
          )}
        </div>

        {/* Footer — splits by auth state */}
        <div className="border-t border-base-300 bg-base-200 p-4 space-y-3">

          {/* ══ LOGGED IN: totals + Excel export ══ */}
          {session ? (
            <>
              {subtotal > 0 && (
                <div className="bg-base-100 rounded-xl p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-base-content/60">
                    <span>Subtotal USD</span><span>${fmtUSD(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-base-content/60">
                    <span>IVA 16%</span><span>${fmtUSD(iva)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base-content border-t border-base-300 pt-1.5">
                    <span>Total USD</span><span>${fmtUSD(total)}</span>
                  </div>
                </div>
              )}

              {hayPreciosPendientes && (
                <div className="flex items-start gap-2 bg-warning/10 border border-warning/20 rounded-lg px-3 py-2 text-xs text-base-content/60">
                  <i className="ti ti-info-circle text-warning mt-0.5 flex-shrink-0" />
                  Algunos productos no tienen precio. Se exportarán como &ldquo;Cotizar&rdquo;.
                </div>
              )}

              <button
                onClick={onExport}
                disabled={items.length === 0}
                className="btn btn-primary w-full gap-2"
              >
                <i className="ti ti-file-spreadsheet text-lg" /> Exportar cotización (.xlsx)
              </button>

              {session?.user?.isAdmin && (
                <button
                  onClick={onSendOdoo}
                  disabled={items.length === 0}
                  className="btn btn-secondary w-full gap-2"
                >
                  <i className="ti ti-send text-lg" /> Mandar cotización a Odoo
                </button>
              )}

              <button onClick={onClose} className="btn btn-ghost btn-sm w-full text-base-content/50">
                Seguir agregando productos
              </button>
            </>
          ) : (
            /* ══ GUEST: contact form ══ */
            enviado ? (
              /* Success state */
              <div className="flex flex-col items-center text-center py-4 gap-3">
                <div className="w-14 h-14 rounded-full bg-success/15 flex items-center justify-center">
                  <i className="ti ti-circle-check text-4xl text-success" />
                </div>
                <div>
                  <p className="font-bold text-base-content">¡Solicitud enviada!</p>
                  <p className="text-sm text-base-content/60 mt-1">
                    Un asesor revisará tu cotización y te contactará a <strong>{contacto.email}</strong> o al <strong>{contacto.telefono}</strong> en menos de 2 horas hábiles.
                  </p>
                </div>
                <button onClick={onClose} className="btn btn-primary btn-sm mt-1">
                  Aceptar
                </button>
              </div>
            ) : (
              /* Form */
              <>
                <div className="bg-primary/8 border border-primary/15 rounded-lg px-3 py-2.5 flex items-start gap-2 text-xs text-base-content/70">
                  <i className="ti ti-info-circle text-primary mt-0.5 flex-shrink-0" />
                  <span>
                    Completa tus datos y un asesor te enviará la cotización por correo en menos de 2 horas.{" "}
                    <button
                      onClick={() => signIn(undefined, { callbackUrl: "/" })}
                      className="text-primary font-semibold underline underline-offset-2"
                    >
                      Inicia sesión
                    </button>{" "}
                    para ver precios y exportar directamente.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wide text-base-content/50 mb-1 block">Nombre *</label>
                    <input
                      type="text"
                      value={contacto.nombre}
                      onChange={setField("nombre")}
                      placeholder="Juan"
                      className="input input-bordered input-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wide text-base-content/50 mb-1 block">Apellido *</label>
                    <input
                      type="text"
                      value={contacto.apellido}
                      onChange={setField("apellido")}
                      placeholder="García"
                      className="input input-bordered input-sm w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-base-content/50 mb-1 block">Empresa *</label>
                  <input
                    type="text"
                    value={contacto.empresa}
                    onChange={setField("empresa")}
                    placeholder="Empresa SA de CV"
                    className="input input-bordered input-sm w-full"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-base-content/50 mb-1 block">Correo electrónico *</label>
                  <input
                    type="email"
                    value={contacto.email}
                    onChange={setField("email")}
                    placeholder="correo@empresa.com"
                    className="input input-bordered input-sm w-full"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-base-content/50 mb-1 block">Teléfono / WhatsApp *</label>
                  <input
                    type="tel"
                    value={contacto.telefono}
                    onChange={setField("telefono")}
                    placeholder="+52 614 123 4567"
                    className="input input-bordered input-sm w-full"
                  />
                </div>

                {formError && (
                  <div className="flex items-center gap-2 text-xs text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
                    <i className="ti ti-alert-circle flex-shrink-0" /> {formError}
                  </div>
                )}

                <button
                  onClick={solicitarCotizacion}
                  disabled={enviando || items.length === 0}
                  className="btn btn-primary w-full gap-2"
                >
                  {enviando ? (
                    <><span className="loading loading-spinner loading-xs" /> Enviando…</>
                  ) : (
                    <><i className="ti ti-send text-lg" /> Solicitar cotización</>
                  )}
                </button>

                <button onClick={onClose} className="btn btn-ghost btn-sm w-full text-base-content/50">
                  Seguir agregando productos
                </button>
              </>
            )
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Single product card ─── */
function ProductCard({ p, session, onCotizar, onAgregar, cartQty, fmtPrecio }) {
  const [qty, setQty] = useState(1);
  const entrega = getEntregaInfo(p);
  const desc    = p.desc || nombreFriendly(p.pn, p.marca);
  const precio  = fmtPrecio ? fmtPrecio(p.esRemate ? p.precioRemate : p.precioUSD) : formatPrecioUSD(p.precioUSD);

  const borderTop =
    entrega.tipo === "mx"
      ? "border-t-[3px] border-t-success"
      : entrega.tipo === "usa"
      ? "border-t-[3px] border-t-warning"
      : "border-t-[3px] border-t-base-300";

  const stockMX = p.stockMX || 0;
  const esCHN   = p.sourcingJun === "CHN to MTY";
  const secondaryStock = esCHN ? (p.stockCHN || 0) : (p.stockUSA || 0);
  const secondaryLabel = esCHN ? "China" : "USA";
  const secondaryFlag  = esCHN ? "🇨🇳" : "🇺🇸";

  const handleQtyChange = (e) => {
    const v = parseInt(e.target.value) || 1;
    setQty(Math.max(1, v));
  };

  return (
    <div
      className={`card card-compact bg-base-100 border shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 overflow-hidden flex flex-col ${p.esRemate ? "border-orange-400 border-2" : "border-base-300 " + borderTop}`}
    >
      {/* Remate badge */}
      {p.esRemate && (
        <div className="bg-orange-500 text-white text-[10px] font-bold tracking-widest uppercase text-center py-0.5 flex items-center justify-center gap-2">
          🔥 REMATE
          {p.cantidadRemate > 0 && (
            <span className="bg-white/20 px-1.5 rounded">{p.cantidadRemate} pzas</span>
          )}
          🔥
        </div>
      )}

      <ProductImage p={p} href={p.urlProducto || undefined} />

      <div className="card-body flex flex-col flex-1 gap-1 p-3">
        {/* Brand + family */}
        <p className="text-[9px] font-bold tracking-[1.5px] uppercase text-base-content/40">
          {p.marca}{p.familia ? ` · ${p.familia}` : ""}
        </p>

        {/* Part number */}
        <p className="font-mono font-semibold text-sm text-base-content">{p.pn}</p>

        {/* Description — clamped to 3 lines, wrapper takes remaining vertical space */}
        <div className="flex-1 overflow-hidden min-h-[3rem]">
          <p className="text-xs text-base-content/60 leading-relaxed line-clamp-3">{desc}</p>
        </div>

        {/* Stock quantities — gated by sourcing rule */}
        <div className="flex flex-wrap gap-1 py-1.5 border-t border-base-200">
          {session ? (
            <>
              {stockMX > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-success bg-success/10 px-1.5 py-0.5 rounded">
                  🇲🇽 {stockMX} MX
                </span>
              )}
              {secondaryStock > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-info bg-info/10 px-1.5 py-0.5 rounded">
                  {secondaryFlag} {secondaryStock} {secondaryLabel}
                </span>
              )}
              {stockMX === 0 && secondaryStock === 0 && (
                <span className="text-[10px] text-base-content/30">
                  {entrega.tipo === "pedido" ? "Bajo pedido" : "Consultar"}
                </span>
              )}
            </>
          ) : (
            <span className="text-[10px] font-semibold text-base-content/50">
              {stockMX > 0 && secondaryStock > 0
                ? `Disponible en MX & ${secondaryLabel}`
                : stockMX > 0
                ? "Disponible en MX"
                : secondaryStock > 0
                ? `Disponible en ${secondaryLabel}`
                : entrega.tipo === "pedido"
                ? "Bajo pedido"
                : "Sin stock"}
            </span>
          )}
        </div>

        {/* Price row */}
        <div className="flex items-center gap-2">
          {session ? (
            p.esRemate ? (
              <div className="flex flex-col">
                <span className="font-mono font-bold text-sm text-orange-500">
                  {fmtPrecio ? fmtPrecio(p.precioRemate) : `$${p.precioRemate?.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD`}
                </span>
                {p.precioOriginal > 0 && (
                  <span className="font-mono text-xs text-base-content/40 line-through">
                    {fmtPrecio ? fmtPrecio(p.precioOriginal) : `$${p.precioOriginal?.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                  </span>
                )}
              </div>
            ) : precio ? (
              <span className="font-mono font-bold text-sm text-base-content">{precio}</span>
            ) : (
              <span className="text-xs text-base-content/40">Consultar precio</span>
            )
          ) : (
            <button
              onClick={() => signIn(undefined, { callbackUrl: "/" })}
              className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline"
            >
              <i className="ti ti-lock text-xs" /> Ver precio
            </button>
          )}
        </div>

        {/* Delivery badge + time on same row */}
        <p className="text-[10px] text-base-content/40 flex items-center gap-1.5">
          <span
            className={
              entrega.tipo === "mx"
                ? "badge badge-success badge-sm text-white shrink-0"
                : entrega.tipo === "usa"
                ? "badge badge-warning badge-sm text-white shrink-0"
                : "badge badge-ghost badge-sm shrink-0"
            }
          >
            {entrega.tipo === "mx"
              ? "🇲🇽 MX"
              : entrega.tipo === "usa"
              ? (p.sourcingJun === "CHN to MTY" ? "🇨🇳 CHN" : "🇺🇸 USA")
              : entrega.tipo === "pedido"
              ? "Pedido"
              : "Consultar"}
          </span>
          <i className="ti ti-clock text-xs" /> {entrega.tiempo}
        </p>

        {/* Qty stepper + Add to quote */}
        <div className="flex items-center gap-1.5 mt-1 pt-2 border-t border-base-200">
          {/* Stepper — compact */}
          <div className="flex items-center border border-base-300 rounded overflow-hidden flex-shrink-0">
            <button
              onClick={(e) => { e.preventDefault(); setQty((q) => Math.max(1, q - 1)); }}
              className="w-6 h-7 flex items-center justify-center text-base-content/50 hover:bg-base-200 text-xs"
            >
              −
            </button>
            <input
              type="number"
              value={qty}
              min={1}
              onChange={handleQtyChange}
              onClick={(e) => e.stopPropagation()}
              className="w-8 h-7 text-center text-xs font-mono bg-transparent border-x border-base-300 focus:outline-none"
            />
            <button
              onClick={(e) => { e.preventDefault(); setQty((q) => q + 1); }}
              className="w-6 h-7 flex items-center justify-center text-base-content/50 hover:bg-base-200 text-xs"
            >
              +
            </button>
          </div>

          {/* Add button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              onAgregar(p, qty);
            }}
            className={`btn btn-xs flex-1 gap-1 h-7 min-h-0 text-xs ${
              cartQty > 0 ? "btn-success" : "btn-primary"
            }`}
          >
            {cartQty > 0 ? (
              <><i className="ti ti-check text-xs" /> Agregar más</>
            ) : (
              "Agregar a cotización"
            )}
          </button>
        </div>

        {/* In-cart indicator */}
        {cartQty > 0 && (
          <p className="text-[10px] text-success text-center font-semibold -mt-0.5">
            {cartQty} pieza{cartQty !== 1 ? "s" : ""} en cotización
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Category card ─── */
function CatCard({ icon, name, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className="card bg-base-100 border border-base-300 shadow-sm hover:shadow hover:border-primary hover:-translate-y-0.5 transition-all duration-150 p-4 text-left cursor-pointer"
    >
      <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xl mb-3">
        <i className={`ti ${icon}`} />
      </div>
      <p className="text-xs font-semibold text-base-content leading-snug">{name}</p>
      <p className="text-[10px] text-base-content/40 mt-0.5">{sub}</p>
    </button>
  );
}

/* ═══════════════════════════════════════════
   MAIN CATALOG PAGE
═══════════════════════════════════════════ */
export default function CatalogPage() {
  const { data: session } = useSession();
  const modalRef   = useRef(null);
  const catalogRef = useRef(null);

  /* ── Catalog state ── */
  const [productos,       setProductos]       = useState([]);
  const [stockUpdatedAt,  setStockUpdatedAt]  = useState(null);
  const [cargando,        setCargando]        = useState(true);
  const [busquedaInput,   setBusquedaInput]   = useState("");
  const [busqueda,        setBusqueda]        = useState("");
  const [filtroActivo,    setFiltroActivo]    = useState("all");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroFamilia,   setFiltroFamilia]   = useState("");

  /* ── Pagination ── */
  const POR_PAGINA = 60;
  const [paginaActual, setPaginaActual] = useState(1);

  /* ── Currency ── */
  const monedaCliente = session?.user?.customer?.moneda || "USD";
  const [tipoCambio, setTipoCambio] = useState(null);

  useEffect(() => {
    if (monedaCliente === "MXN") {
      fetch("/api/tipo-cambio")
        .then((r) => r.json())
        .then((d) => { if (d.mxnPerUsd) setTipoCambio(d.mxnPerUsd); })
        .catch(() => {});
    }
  }, [monedaCliente]);

  const fmtPrecio = (usd) => {
    if (!usd || usd <= 0) return null;
    if (monedaCliente === "MXN" && tipoCambio) {
      const mxn = Math.round((usd * (tipoCambio + 1)) * 10) / 10;
      return `$${mxn.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MXN`;
    }
    return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD`;
  };

  /* ── Quote cart state ── */
  const [cotizacion, setCotizacion] = useState([]);
  const [cartOpen,   setCartOpen]   = useState(false);

  /* ── WhatsApp modal state ── */
  const [modalPN,      setModalPN]      = useState("");
  const [modalQty,     setModalQty]     = useState(1);
  const [formNombre,   setFormNombre]   = useState("");
  const [formContacto, setFormContacto] = useState("");
  const [formNotas,    setFormNotas]    = useState("");

  /* ── Load catalog via server API (avoids slow client-side CSV parsing) ── */
  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((data) => {
        const lista = data?.productos ?? data;
        setProductos(Array.isArray(lista) && lista.length > 0 ? lista : DEMO_PRODUCTOS);
        if (data?.stockUpdatedAt) setStockUpdatedAt(new Date(data.stockUpdatedAt));
      })
      .catch(() => setProductos(DEMO_PRODUCTOS))
      .finally(() => setCargando(false));
  }, []);

  /* ── Derived ── */
  const productosFiltrados = filtrarProductos(productos, {
    busqueda, filtroActivo, filtroCategoria, filtroFamilia,
  });

  const productosMostrados = productosFiltrados.slice(0, paginaActual * POR_PAGINA);
  const hayMas = productosFiltrados.length > paginaActual * POR_PAGINA;

  const totalDisponibles = productos.filter((p) => p.stockMX > 0 || p.stockUSA > 0).length;

  const mostrarTaxonomy =
    filtroActivo === "all" || filtroActivo === "BANNER" || filtroActivo === "MX";

  const categoriasBanner = mostrarTaxonomy
    ? [
        ...new Set(
          productos
            .filter((p) => p.categoria && p.marca === "BANNER")
            .map((p) => p.categoria)
        ),
      ]
    : [];

  const familiasBanner = filtroCategoria
    ? [
        ...new Set(
          productos
            .filter((p) => p.categoria === filtroCategoria && p.familia)
            .map((p) => p.familia)
        ),
      ]
    : [];

  /* ── Cart helpers ── */
  const agregarACotizacion = (p, qty) => {
    setCotizacion((prev) => {
      const existing = prev.find((i) => i.pn === p.pn);
      if (existing) {
        return prev.map((i) =>
          i.pn === p.pn ? { ...i, qty: i.qty + qty } : i
        );
      }
      return [
        ...prev,
        {
          pn:            p.pn,
          desc:          p.desc || nombreFriendly(p.pn, p.marca),
          marca:         p.marca || "",
          precioUSD:     p.esRemate ? p.precioRemate : (p.precioUSD || 0),
          qty,
          esRemate:      p.esRemate || false,
          tiempoEntrega: getEntregaInfo(p).tiempo || "",
          stockMX:       p.stockMX    || 0,
          stockUSA:      p.stockUSA   || 0,
          stockCHN:      p.stockCHN   || 0,
          sourcingJun:   p.sourcingJun || null,
        },
      ];
    });
  };

  const actualizarQty = (pn, qty) =>
    setCotizacion((prev) => prev.map((i) => (i.pn === pn ? { ...i, qty } : i)));

  const quitarDeCotizacion = (pn) =>
    setCotizacion((prev) => prev.filter((i) => i.pn !== pn));

  const totalPiezasCart = cotizacion.reduce((s, i) => s + i.qty, 0);

  /* ── Navigation helpers ── */
  const scrollToCatalog = () =>
    catalogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const handleBuscar = () => {
    setBusqueda(busquedaInput.trim());
    setPaginaActual(1);
    scrollToCatalog();
  };

  const handleFiltroMarca = (marca) => {
    setFiltroActivo(marca);
    setFiltroCategoria("");
    setFiltroFamilia("");
    setPaginaActual(1);
    scrollToCatalog();
  };

  /* ── WhatsApp modal ── */
  const openModal = (pn) => {
    setModalPN(pn);
    setModalQty(1);
    modalRef.current?.showModal();
  };

  const enviarCotizacion = () => {
    if (!modalPN || !formNombre || !formContacto) {
      alert("Por favor completa número de parte, nombre y contacto.");
      return;
    }
    const msg = [
      `📦 *Solicitud de cotización*`,
      `N/P: *${modalPN}*`,
      `Cantidad: ${modalQty} pza${modalQty !== 1 ? "s" : ""}`,
      ``,
      `👤 ${formNombre}`,
      `📞 ${formContacto}`,
      formNotas ? `📝 ${formNotas}` : null,
      ``,
      `_Enviado desde ${CATALOG_CONFIG.DOMINIO}_`,
    ]
      .filter(Boolean)
      .join("\n");

    window.open(
      `https://wa.me/${CATALOG_CONFIG.WHATSAPP}?text=${encodeURIComponent(msg)}`,
      "_blank"
    );
    modalRef.current?.close();
    setFormNombre("");
    setFormContacto("");
    setFormNotas("");
  };

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  return (
    <>
      {/* ── HERO ── */}
      <section className="py-20 relative overflow-hidden" style={{ minHeight: "480px" }}>
        {/* Background image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://bannerengineering-h.assetsadobe.com/is/image//content/dam/banner-engineering/3d-renders/product-group/divisionimages2024/updated/Div-Main-product-grouping-ctr.psd?wid=1200&hei=630&fit=crop&qlt=60&fmt=png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: "75% center" }}
        />
        {/* Gradient: dark left → transparent right */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to right, #0f1e2e 40%, rgba(15,30,46,0.7) 65%, rgba(15,30,46,0.1) 100%)" }} />
        <div className="absolute top-0 left-0 w-1 h-full bg-primary" />

        <div className="max-w-6xl mx-auto px-6 relative">
          <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-white/8 border border-white/12 rounded-full px-4 py-1.5 text-[11px] tracking-widest uppercase text-white/70 mb-6">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
            {stockUpdatedAt
              ? `Stock actualizado: ${stockUpdatedAt.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}`
              : "Stock actualizado"}
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight tracking-tight mb-4">
            Componentes de{" "}
            <span className="text-primary">automatización industrial</span>
            <br />con entrega en México
          </h1>

          <p className="text-base text-white/60 max-w-lg leading-relaxed mb-8">
            Distribuidor de Banner Engineering, Schneider Electric, Turck y Wago.
            Stock disponible · Cotización en &lt;2 horas · Envío a todo México.
          </p>

          <p className="text-[10px] tracking-[2px] uppercase text-white/30 flex gap-3 flex-wrap">
            <span>BANNER ENGINEERING</span>
            <span className="opacity-40">·</span>
            <span>SCHNEIDER ELECTRIC</span>
            <span className="opacity-40">·</span>
            <span>TURCK</span>
            <span className="opacity-40">·</span>
            <span>WAGO</span>
          </p>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <div className="bg-primary text-primary-content py-4">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[
            { val: cargando ? "—" : totalDisponibles.toLocaleString("es-MX"), label: "productos disponibles" },
            { val: "+18k",     label: "referencias en catálogo" },
            { val: "<2 h",     label: "tiempo de cotización" },
            { val: "3–4 días", label: "entrega en México" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-xl font-bold">{s.val}</p>
              <p className="text-[11px] opacity-75">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── CATEGORY BROWSE ── (hidden) */}
      <section className="bg-base-200 py-10 border-b border-base-300 hidden">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase text-primary mb-1">Explorar</p>
              <h2 className="text-xl font-bold text-base-content">Comprar por categoría</h2>
            </div>
            <button
              onClick={() => handleFiltroMarca("all")}
              className="text-sm text-primary font-semibold flex items-center gap-1 hover:underline"
            >
              Ver todo <i className="ti ti-arrow-right text-sm" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { icon: "ti-eye",           name: "Sensores fotoeléctricos", sub: "Banner",    marca: "BANNER" },
              { icon: "ti-cpu",           name: "PLCs y Control",          sub: "Schneider", marca: "SCHNEIDER" },
              { icon: "ti-shield-check",  name: "Seguridad industrial",    sub: "Banner",    marca: "BANNER" },
              { icon: "ti-magnet",        name: "Sensores inductivos",     sub: "Turck",     marca: "TURCK" },
              { icon: "ti-plug",          name: "Terminales",              sub: "Wago",      marca: "WAGO" },
              { icon: "ti-refresh",       name: "Variadores",              sub: "Schneider", marca: "SCHNEIDER" },
              { icon: "ti-circuit-board", name: "Módulos I/O",             sub: "Turck",     marca: "TURCK" },
              { icon: "ti-bolt",          name: "Fuentes de poder",        sub: "Wago",      marca: "WAGO" },
            ].map((c) => (
              <CatCard
                key={c.name}
                icon={c.icon}
                name={c.name}
                sub={c.sub}
                onClick={() => handleFiltroMarca(c.marca)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── CATALOG ── */}
      <section ref={catalogRef} className="bg-base-100 py-12" id="catalogo">
        <div className="w-full px-4 lg:px-6 xl:px-8">

          {/* Section header */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase text-primary mb-1">Inventario</p>
              <h2 className="text-xl font-bold text-base-content">Catálogo disponible</h2>
              <p className="text-xs text-base-content/50 mt-0.5">
                {cargando
                  ? "Cargando inventario…"
                  : `${productosFiltrados.length.toLocaleString("es-MX")} producto${
                      productosFiltrados.length !== 1 ? "s" : ""
                    } · Stock actualizado: ${stockUpdatedAt ? stockUpdatedAt.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—"}`}
              </p>
            </div>

            {/* Brand filters */}
            <div className="flex flex-wrap gap-2">
              {[
                { f: "all",       label: "Todos" },
                { f: "BANNER",    label: "Banner" },
                { f: "SCHNEIDER", label: "Schneider" },
                { f: "TURCK",     label: "Turck" },
                { f: "WAGO",      label: "Wago" },
                { f: "MX",        label: "🇲🇽 Stock MX" },
                { f: "REMATE",    label: "🔥 Remate" },
              ].map(({ f, label }) => (
                <button
                  key={f}
                  onClick={() => handleFiltroMarca(f)}
                  className={`btn btn-sm rounded-full ${
                    filtroActivo === f && f === "REMATE"
                      ? "bg-orange-500 text-white border-orange-500 hover:bg-orange-600"
                      : filtroActivo === f
                      ? "btn-primary"
                      : "btn-ghost border border-base-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Search + Taxonomy filters — 3-col grid on desktop, stacked on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 bg-base-100 border border-base-300 rounded-lg p-3 shadow-sm">
            {/* Search */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-base-content/40">
                Número de parte
              </label>
              <div className="flex rounded overflow-hidden border border-base-300">
                <input
                  type="text"
                  value={busquedaInput}
                  onChange={(e) => setBusquedaInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
                  placeholder="ej: TL70, sensor, touch, curtain…"
                  className="flex-1 bg-base-100 text-base-content text-sm font-mono px-3 py-2.5 outline-none placeholder:text-base-content/30 min-w-0"
                />
                <button
                  onClick={handleBuscar}
                  className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <i className="ti ti-search text-sm" /> Buscar
                </button>
              </div>
            </div>

            {/* Categoría */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-base-content/40">
                Categoría
              </label>
              <select
                value={filtroCategoria}
                onChange={(e) => { setFiltroCategoria(e.target.value); setFiltroFamilia(""); setPaginaActual(1); }}
                className="select select-sm select-bordered w-full text-sm"
              >
                <option value="">Todas las categorías</option>
                {categoriasBanner.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Familia */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-base-content/40">
                Familia
              </label>
              <select
                value={filtroFamilia}
                onChange={(e) => { setFiltroFamilia(e.target.value); setPaginaActual(1); }}
                disabled={!filtroCategoria || familiasBanner.length === 0}
                className="select select-sm select-bordered w-full text-sm disabled:opacity-40"
              >
                <option value="">Todas las familias</option>
                {familiasBanner.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Auth notice */}
          {!session && (
            <div className="alert border border-primary/20 bg-primary/5 mb-6">
              <i className="ti ti-lock text-primary text-lg" />
              <span className="text-sm text-base-content">
                <strong>Inicia sesión</strong> para ver precios en tu cotización.
              </span>
              <button
                onClick={() => signIn(undefined, { callbackUrl: "/" })}
                className="btn btn-primary btn-sm ml-auto"
              >
                Iniciar sesión
              </button>
            </div>
          )}

          {/* Loading */}
          {cargando && (
            <div className="flex flex-col items-center py-20 text-base-content/40">
              <span className="loading loading-spinner loading-lg text-primary" />
              <p className="mt-4 text-sm">Consultando inventario…</p>
            </div>
          )}

          {/* No results */}
          {!cargando && productosFiltrados.length === 0 && (
            <div className="text-center py-20 text-base-content/40">
              <i className="ti ti-search-off text-5xl mb-4 block opacity-30" />
              <p className="text-sm mb-1">
                No encontramos <strong>&quot;{busqueda}&quot;</strong> en nuestro catálogo.
              </p>
              <p className="text-xs mb-6">Aún podemos conseguirlo. Déjanos tus datos y te cotizamos.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {busqueda.trim() && (
                  <button
                    onClick={() => {
                      agregarACotizacion({ pn: busqueda.trim().toUpperCase(), desc: "", marca: "", precioUSD: 0, stockMX: 0, stockUSA: 0 }, 1);
                      toast.success(`${busqueda.trim().toUpperCase()} agregado a tu cotización`);
                    }}
                    className="btn btn-outline btn-sm gap-2"
                  >
                    <i className="ti ti-shopping-cart-plus" /> Agregar &quot;{busqueda.trim().toUpperCase()}&quot; a cotización
                  </button>
                )}
                <button onClick={() => openModal(busqueda)} className="btn btn-primary btn-sm">
                  Solicitar cotización especial
                </button>
              </div>
            </div>
          )}

          {/* Product grid */}
          {!cargando && productosFiltrados.length > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 gap-4">
                {productosMostrados.map((p) => (
                  <ProductCard
                    key={p.pn}
                    p={p}
                    session={session}
                    onCotizar={openModal}
                    onAgregar={agregarACotizacion}
                    cartQty={cotizacion.find((i) => i.pn === p.pn)?.qty || 0}
                    fmtPrecio={fmtPrecio}
                  />
                ))}
              </div>

              {hayMas && (
                <div className="flex flex-col items-center gap-2 pt-8">
                  <p className="text-xs text-base-content/40">
                    Mostrando {productosMostrados.length.toLocaleString("es-MX")} de {productosFiltrados.length.toLocaleString("es-MX")} productos
                  </p>
                  <button
                    onClick={() => setPaginaActual((p) => p + 1)}
                    className="btn btn-ghost border border-base-300 btn-sm gap-2"
                  >
                    <i className="ti ti-refresh text-sm" /> Ver más productos
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ── TRUST BADGES ── */}
      <div className="bg-neutral py-8">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { icon: "ti-shield-check",  title: "Producto original",     sub: "Garantía de autenticidad en todas las marcas" },
            { icon: "ti-truck-delivery",title: "Envío rápido a México", sub: "Stock MX: 3–4 días hábiles garantizados" },
            { icon: "ti-clock",         title: "Cotización en <2 h",    sub: "Respuesta garantizada en horario hábil" },
            { icon: "ti-headset",       title: "Soporte técnico",       sub: "Asesoría especializada sin costo adicional" },
          ].map((t) => (
            <div key={t.title} className="flex flex-col items-center gap-2">
              <i className={`ti ${t.icon} text-3xl text-primary`} />
              <p className="text-sm font-semibold text-neutral-content">{t.title}</p>
              <p className="text-xs text-neutral-content/40 leading-snug">{t.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── BRANDS ── */}
      <section className="bg-base-200 py-12 border-t border-base-300" id="marcas">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-[11px] font-bold tracking-widest uppercase text-primary mb-1">Distribuidores</p>
          <h2 className="text-xl font-bold text-base-content mb-6">Marcas que manejamos</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { marca: "BANNER",    name: "Banner Engineering", desc: "Sensores fotoeléctricos, inductivos, ultrasonido, cortinas de seguridad, torres de señalización y conectividad IIoT." },
              { marca: "SCHNEIDER", name: "Schneider Electric",  desc: "PLCs Modicon, variadores ATV, interruptores NSX, contactores LC1 y mandos de señalización XB." },
              { marca: "TURCK",     name: "Turck",               desc: "Sensores inductivos, capacitivos y magnéticos. Módulos I/O remotos IP67 para entornos industriales severos." },
              { marca: "WAGO",      name: "Wago",                desc: "Bloques de terminales push-in 221, fuentes EPSITRON y controladores de automatización serie 750." },
            ].map((b) => (
              <div
                key={b.marca}
                onClick={() => handleFiltroMarca(b.marca)}
                className="card bg-base-100 border border-base-300 shadow-sm hover:shadow hover:border-primary transition-all duration-150 p-5 cursor-pointer"
              >
                <h3 className="font-bold text-base text-base-content mb-2">{b.name}</h3>
                <p className="text-xs text-base-content/55 leading-relaxed mb-4">{b.desc}</p>
                <span className="text-sm text-primary font-semibold flex items-center gap-1">
                  Ver productos <i className="ti ti-arrow-right text-sm" />
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section className="bg-base-100 py-12" id="contacto">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase text-primary mb-1">Contacto</p>
              <h2 className="text-xl font-bold text-base-content mb-3">¿No encuentras lo que buscas?</h2>
              <p className="text-sm text-base-content/55 max-w-sm leading-relaxed mb-6">
                Tenemos acceso a más de 18,000 referencias. Si no aparece en el catálogo, lo conseguimos.
              </p>
              <div className="flex flex-col gap-3">
                {[
                  { icon: "ti-brand-whatsapp", text: "+52 614 XXX XXXX", href: `https://wa.me/${CATALOG_CONFIG.WHATSAPP}` },
                  { icon: "ti-mail",           text: "ventas@TU-DOMINIO.com", href: "mailto:ventas@TU-DOMINIO.com" },
                  { icon: "ti-map-pin",        text: "Chihuahua, Chih. México", href: null },
                ].map((c) =>
                  c.href ? (
                    <a
                      key={c.text}
                      href={c.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-sm text-base-content/55 hover:text-primary transition-colors"
                    >
                      <i className={`ti ${c.icon} text-primary text-lg`} /> {c.text}
                    </a>
                  ) : (
                    <span key={c.text} className="flex items-center gap-3 text-sm text-base-content/55">
                      <i className={`ti ${c.icon} text-primary text-lg`} /> {c.text}
                    </span>
                  )
                )}
              </div>
            </div>

            <div className="text-center">
              <button onClick={() => openModal("")} className="btn btn-primary btn-lg">
                <i className="ti ti-file-invoice" /> Solicitar cotización
              </button>
              <p className="text-xs text-base-content/35 mt-3">
                Respuesta garantizada en &lt; 2 horas hábiles
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FLOATING CART BUTTON ── */}
      {cotizacion.length > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 right-6 z-40 btn btn-primary btn-lg shadow-2xl rounded-2xl gap-2 pr-4"
        >
          <i className="ti ti-clipboard-list text-xl" />
          <span className="font-semibold">Mi cotización</span>
          <span className="badge badge-warning font-bold ml-1">{totalPiezasCart}</span>
        </button>
      )}

      {/* ── QUOTE CART PANEL ── */}
      {cartOpen && (
        <QuoteCartPanel
          items={cotizacion}
          session={session}
          onUpdateQty={actualizarQty}
          onRemove={quitarDeCotizacion}
          onExport={() => exportarCotizacionXLSX(cotizacion)}
          onSendOdoo={async () => {
            try {
              const res = await fetch("/api/admin/cotizacion-odoo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: cotizacion }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "Error");
              toast.success(`Cotización ${data.name} creada en Odoo`);
            } catch (err) {
              toast.error(err.message || "Error al enviar a Odoo");
            }
          }}
          onClose={() => setCartOpen(false)}
        />
      )}

      {/* ── WHATSAPP QUOTE MODAL ── */}
      <dialog ref={modalRef} className="modal">
        <div className="modal-box max-w-md">
          <button
            className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3"
            onClick={() => modalRef.current?.close()}
          >
            ✕
          </button>

          <h3 className="font-bold text-lg text-base-content mb-0.5">Solicitar cotización</h3>
          <p className="text-sm text-base-content/50 mb-5">
            Te respondemos en menos de 2 horas en horario hábil.
          </p>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="form-control">
                <span className="label-text text-xs font-semibold mb-1">Número de parte</span>
                <input
                  type="text"
                  value={modalPN}
                  onChange={(e) => setModalPN(e.target.value)}
                  placeholder="ej: S18-2VP6D"
                  className="input input-bordered input-sm font-mono"
                />
              </label>
              <label className="form-control">
                <span className="label-text text-xs font-semibold mb-1">Cantidad</span>
                <input
                  type="number"
                  value={modalQty}
                  onChange={(e) => setModalQty(Number(e.target.value))}
                  min={1}
                  className="input input-bordered input-sm"
                />
              </label>
            </div>

            <label className="form-control">
              <span className="label-text text-xs font-semibold mb-1">Tu nombre y empresa</span>
              <input
                type="text"
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                placeholder="Nombre · Empresa SA de CV"
                className="input input-bordered input-sm"
              />
            </label>

            <label className="form-control">
              <span className="label-text text-xs font-semibold mb-1">WhatsApp o correo</span>
              <input
                type="text"
                value={formContacto}
                onChange={(e) => setFormContacto(e.target.value)}
                placeholder="+52 614 XXX XXXX o correo@empresa.com"
                className="input input-bordered input-sm"
              />
            </label>

            <label className="form-control">
              <span className="label-text text-xs font-semibold mb-1">
                Notas <span className="font-normal opacity-50">(opcional)</span>
              </span>
              <textarea
                value={formNotas}
                onChange={(e) => setFormNotas(e.target.value)}
                rows={2}
                placeholder="Urgencia, aplicación, otras referencias…"
                className="textarea textarea-bordered textarea-sm resize-none"
              />
            </label>

            <button onClick={enviarCotizacion} className="btn btn-primary btn-block">
              <i className="ti ti-brand-whatsapp" /> Enviar por WhatsApp
            </button>

            <p className="text-[10px] text-center text-base-content/30">
              Tu información solo se usa para contactarte sobre esta cotización.
            </p>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </>
  );
}
