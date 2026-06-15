"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function CustomerActions({ customerId, currentStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState(null); // 'approve' | 'reject' | null

  const handleAction = async (action) => {
    setLoading(action);
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
        toast.success(
          action === "approve" ? "Cliente aprobado." : "Cliente rechazado."
        );
        router.refresh();
      }
    } catch (err) {
      toast.error("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex gap-2 flex-wrap">
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
  );
}
