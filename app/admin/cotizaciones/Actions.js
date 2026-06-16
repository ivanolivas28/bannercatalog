"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function CotizacionActions({
  cotizacionId,
  currentStatus,
  items,
  customerName,
  customerEmail,
  customerWhatsapp,
  customerEmpresa,
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSendToOdoo = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/cotizaciones/${cotizacionId}/odoo`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Error al enviar a Odoo.");
      } else {
        toast.success(
          `Cotización creada en Odoo: ${data.odooQuotationName || "OK"}`
        );
        router.refresh();
      }
    } catch (err) {
      toast.error("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2 flex-wrap">
      {/* View items tooltip/detail */}
      {items?.length > 0 && (
        <div className="dropdown dropdown-left">
          <label
            tabIndex={0}
            className="btn btn-xs btn-ghost btn-outline"
          >
            Ver {items.length} producto{items.length !== 1 ? "s" : ""}
          </label>
          <div
            tabIndex={0}
            className="dropdown-content z-[1] card card-compact shadow bg-base-200 w-72 p-3 mt-1"
          >
            <ul className="text-xs space-y-1">
              {items.map((item, idx) => (
                <li key={idx} className="flex justify-between gap-2">
                  <span className="font-mono">{item.pn}</span>
                  <span className="text-base-content/60">
                    ×{item.qty}
                    {item.precioUSD > 0
                      ? ` — $${item.precioUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Send to Odoo */}
      {currentStatus === "pending" && (
        <button
          onClick={handleSendToOdoo}
          disabled={loading}
          className="btn btn-xs btn-primary"
        >
          {loading ? (
            <span className="loading loading-spinner loading-xs" />
          ) : null}
          Enviar a Odoo
        </button>
      )}

      {currentStatus === "sent_to_odoo" && (
        <span className="text-xs text-base-content/50 italic">Enviada</span>
      )}
    </div>
  );
}
