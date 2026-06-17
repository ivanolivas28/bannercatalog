"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function CustomerActions({ customerId, currentStatus, nombre, whatsapp, email }) {
  const router = useRouter();
  const [loading, setLoading] = useState(null); // 'approve' | 'reject' | null
  const [accessInfo, setAccessInfo] = useState(null); // { accessUrl, whatsappUrl }
  const [copied, setCopied] = useState(false);

  const handleAction = async (action) => {
    setLoading(action);
    setAccessInfo(null);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Error al actualizar el cliente.");
      } else {
        if (action === "approve" || action === "resend") {
          toast.success(action === "approve" ? "Cliente aprobado. Comparte el link de acceso." : "Link regenerado. Comparte el nuevo link.");
          setAccessInfo({
            accessUrl: data.accessUrl,
            whatsappUrl: data.whatsappUrl,
          });
        } else {
          toast.success("Cliente rechazado.");
          router.refresh();
        }
      }
    } catch (err) {
      toast.error("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(null);
    }
  };

  const handleCopy = () => {
    if (!accessInfo?.accessUrl) return;
    navigator.clipboard.writeText(accessInfo.accessUrl).then(() => {
      setCopied(true);
      toast.success("Link copiado al portapapeles.");
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // Build contact WhatsApp URL (just to chat, not approval link)
  const contactWaUrl = whatsapp
    ? `https://wa.me/52${whatsapp.replace(/\D/g, "")}?text=Hola%20${encodeURIComponent(nombre)}%2C%20vi%20tu%20solicitud%20de%20acceso%20al%20cat%C3%A1logo%20de%20EQKOR%20Tienda.%20%C2%BFMe%20puedes%20decir%20a%20qu%C3%A9%20empresa%20perteneces%20y%20qu%C3%A9%20productos%20te%20interesan%3F`
    : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 flex-wrap">
        {/* Contact button — always visible if has WhatsApp */}
        {contactWaUrl && currentStatus === "pending" && (
          <a
            href={contactWaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm btn-outline gap-1"
            style={{ borderColor: "#25d366", color: "#25d366" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.659 1.438 5.168L2 22l4.979-1.418A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zM4 12a8 8 0 118 8 7.962 7.962 0 01-4.007-1.074l-.29-.171-2.955.842.856-2.878-.189-.302A7.96 7.96 0 014 12z" clipRule="evenodd"/>
            </svg>
            Contactar
          </a>
        )}

        {(currentStatus === "pending" || currentStatus === "rejected") && (
          <button
            onClick={() => handleAction("approve")}
            disabled={loading !== null}
            className="btn btn-success btn-sm"
          >
            {loading === "approve" ? (
              <span className="loading loading-spinner loading-xs" />
            ) : null}
            Aprobar
          </button>
        )}
        {currentStatus === "approved" && !accessInfo && (
          <button
            onClick={() => handleAction("resend")}
            disabled={loading !== null}
            className="btn btn-info btn-sm btn-outline"
          >
            {loading === "resend" ? (
              <span className="loading loading-spinner loading-xs" />
            ) : null}
            Reenviar link
          </button>
        )}
        {(currentStatus === "pending" || currentStatus === "approved") && (
          <button
            onClick={() => handleAction("reject")}
            disabled={loading !== null}
            className="btn btn-error btn-sm btn-outline"
          >
            {loading === "reject" ? (
              <span className="loading loading-spinner loading-xs" />
            ) : null}
            Rechazar
          </button>
        )}
      </div>

      {/* Access link panel shown after approval */}
      {accessInfo && (
        <div className="mt-2 p-3 bg-base-200 rounded-lg border border-base-300 max-w-xs text-sm">
          <p className="font-semibold text-xs text-base-content/70 mb-2 uppercase tracking-wide">
            Link de acceso generado
          </p>
          {accessInfo.whatsappUrl ? (
            <a
              href={accessInfo.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-success btn-sm w-full gap-2"
            >
              {/* WhatsApp icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.659 1.438 5.168L2 22l4.979-1.418A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zM4 12a8 8 0 118 8 7.962 7.962 0 01-4.007-1.074l-.29-.171-2.955.842.856-2.878-.189-.302A7.96 7.96 0 014 12z"
                  clipRule="evenodd"
                />
              </svg>
              Enviar por WhatsApp
            </a>
          ) : null}

          {/* Always show copyable link */}
          <div className="mt-2 flex gap-1">
            <input
              readOnly
              value={accessInfo.accessUrl || ""}
              className="input input-bordered input-xs flex-1 min-w-0 text-xs font-mono"
            />
            <button
              onClick={handleCopy}
              className="btn btn-xs btn-outline shrink-0"
            >
              {copied ? "✓" : "Copiar"}
            </button>
          </div>
          <p className="text-xs text-base-content/50 mt-1">
            Válido por 30 días · uso único
          </p>
          <button
            onClick={() => { setAccessInfo(null); router.refresh(); }}
            className="btn btn-xs btn-ghost w-full mt-2"
          >
            Listo ✓
          </button>
        </div>
      )}
    </div>
  );
}
