import connectMongo from "@/libs/mongoose";
import Cotizacion from "@/models/Cotizacion";
import Link from "next/link";
import CotizacionActions from "./Actions";

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status, odooName }) {
  if (status === "pending") {
    return <span className="badge badge-warning badge-sm">Pendiente</span>;
  }
  if (status === "sent_to_odoo") {
    return (
      <span className="badge badge-info badge-sm">
        {odooName ? `Odoo: ${odooName}` : "Enviada a Odoo"}
      </span>
    );
  }
  if (status === "completed") {
    return <span className="badge badge-success badge-sm">Completada</span>;
  }
  return <span className="badge badge-ghost badge-sm">{status}</span>;
}

function SourceBadge({ source }) {
  if (source === "web_loggedin") {
    return <span className="badge badge-primary badge-sm badge-outline">Logueado</span>;
  }
  return <span className="badge badge-ghost badge-sm">Invitado</span>;
}

function CotizacionTable({ cotizaciones }) {
  if (!cotizaciones.length) {
    return (
      <p className="text-base-content/50 text-sm py-6 text-center">
        Sin cotizaciones en esta sección.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="table table-zebra w-full text-sm">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Cliente</th>
            <th className="text-center">Productos</th>
            <th>Fuente</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {cotizaciones.map((c) => (
            <tr key={c.id}>
              <td className="whitespace-nowrap text-xs">{formatDate(c.createdAt)}</td>
              <td>
                <div className="font-medium">{c.customerName}</div>
                <div className="text-xs text-base-content/60">{c.customerEmpresa}</div>
                {c.customerEmail && (
                  <div className="text-xs text-base-content/50">{c.customerEmail}</div>
                )}
                {c.customerWhatsapp && (
                  <a
                    href={`https://wa.me/${c.customerWhatsapp.replace(/\D/g, "")}` }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-500 hover:underline"
                  >
                    WA: {c.customerWhatsapp}
                  </a>
                )}
              </td>
              <td className="text-center">
                <span className="badge badge-neutral">{c.itemsCount}</span>
              </td>
              <td>
                <SourceBadge source={c.source} />
              </td>
              <td>
                <StatusBadge status={c.status} odooName={c.odooQuotationName} />
              </td>
              <td>
                <CotizacionActions
                  cotizacionId={c.id}
                  currentStatus={c.status}
                  items={c.items}
                  customerName={c.customerName}
                  customerEmail={c.customerEmail}
                  customerWhatsapp={c.customerWhatsapp}
                  customerEmpresa={c.customerEmpresa}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function CotizacionesAdminPage() {
  await connectMongo();

  const allCotizaciones = await Cotizacion.find({})
    .sort({ createdAt: -1 })
    .lean()
    .then((docs) =>
      docs.map((d) => ({
        ...d,
        id: d._id.toString(),
        _id: undefined,
        customerId: d.customerId?.toString() || null,
        createdAt: d.createdAt?.toISOString(),
        updatedAt: d.updatedAt?.toISOString(),
        itemsCount: d.items?.length || 0,
        items: d.items || [],
      }))
    );

  const pending = allCotizaciones.filter((c) => c.status === "pending");
  const sentToOdoo = allCotizaciones.filter((c) => c.status === "sent_to_odoo");

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Admin navigation */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link href="/admin/clientes" className="btn btn-sm btn-ghost">
          Clientes
        </Link>
        <Link href="/admin/cotizaciones" className="btn btn-sm btn-primary">
          Cotizaciones
        </Link>
        <Link href="/admin/upload" className="btn btn-sm btn-ghost">
          Subir archivos
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold">Cotizaciones</h1>
        <p className="text-base-content/60 text-sm mt-1">
          Solicitudes de cotización recibidas desde el catálogo.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="stat bg-base-200 rounded-xl p-4">
          <div className="stat-title text-xs">Pendientes</div>
          <div className="stat-value text-warning text-3xl">{pending.length}</div>
        </div>
        <div className="stat bg-base-200 rounded-xl p-4">
          <div className="stat-title text-xs">Enviadas a Odoo</div>
          <div className="stat-value text-info text-3xl">{sentToOdoo.length}</div>
        </div>
        <div className="stat bg-base-200 rounded-xl p-4">
          <div className="stat-title text-xs">Total</div>
          <div className="stat-value text-3xl">{allCotizaciones.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" className="tabs tabs-bordered mb-6">
        <input
          type="radio"
          name="cotizaciones_tabs"
          role="tab"
          className="tab"
          aria-label={`Pendientes (${pending.length})`}
          defaultChecked
        />
        <div role="tabpanel" className="tab-content pt-6">
          <CotizacionTable cotizaciones={pending} />
        </div>

        <input
          type="radio"
          name="cotizaciones_tabs"
          role="tab"
          className="tab"
          aria-label={`Enviadas a Odoo (${sentToOdoo.length})`}
        />
        <div role="tabpanel" className="tab-content pt-6">
          <CotizacionTable cotizaciones={sentToOdoo} />
        </div>

        <input
          type="radio"
          name="cotizaciones_tabs"
          role="tab"
          className="tab"
          aria-label={`Todas (${allCotizaciones.length})`}
        />
        <div role="tabpanel" className="tab-content pt-6">
          <CotizacionTable cotizaciones={allCotizaciones} />
        </div>
      </div>
    </div>
  );
}
