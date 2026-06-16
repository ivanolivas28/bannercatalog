import connectMongo from "@/libs/mongoose";
import Customer from "@/models/Customer";
import CustomerActions from "./Actions";

function StatusBadge({ status }) {
  const map = {
    pending: { label: "Pendiente", cls: "badge-warning" },
    approved: { label: "Aprobado", cls: "badge-success" },
    rejected: { label: "Rechazado", cls: "badge-error" },
  };
  const { label, cls } = map[status] || { label: status, cls: "badge-ghost" };
  return <span className={`badge ${cls} badge-sm`}>{label}</span>;
}

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function CustomerTable({ customers }) {
  if (!customers.length) {
    return (
      <p className="text-base-content/50 text-sm py-6 text-center">
        Sin registros en esta sección.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="table table-zebra w-full">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Empresa</th>
            <th>Correo</th>
            <th>WhatsApp</th>
            <th>Registro</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id}>
              <td className="font-medium whitespace-nowrap">
                {c.nombre} {c.apellido}
              </td>
              <td>{c.empresa}</td>
              <td className="text-sm">{c.email}</td>
              <td className="text-sm">{c.whatsapp}</td>
              <td className="text-sm whitespace-nowrap">
                {formatDate(c.createdAt)}
              </td>
              <td>
                <CustomerActions
                  customerId={c.id}
                  currentStatus={c.status}
                  nombre={c.nombre}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ClientesAdminPage() {
  await connectMongo();

  const allCustomers = await Customer.find({})
    .sort({ createdAt: -1 })
    .lean()
    .then((docs) =>
      docs.map((d) => ({
        ...d,
        id: d._id.toString(),
        _id: undefined,
        createdAt: d.createdAt?.toISOString(),
        approvedAt: d.approvedAt?.toISOString() || null,
        rejectedAt: d.rejectedAt?.toISOString() || null,
      }))
    );

  const pending = allCustomers.filter((c) => c.status === "pending");
  const approved = allCustomers.filter((c) => c.status === "approved");
  const rejected = allCustomers.filter((c) => c.status === "rejected");

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Clientes registrados</h1>
        <p className="text-base-content/60 text-sm mt-1">
          Gestiona las solicitudes de acceso al catálogo.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="stat bg-base-200 rounded-xl p-4">
          <div className="stat-title text-xs">Pendientes</div>
          <div className="stat-value text-warning text-3xl">{pending.length}</div>
        </div>
        <div className="stat bg-base-200 rounded-xl p-4">
          <div className="stat-title text-xs">Aprobados</div>
          <div className="stat-value text-success text-3xl">{approved.length}</div>
        </div>
        <div className="stat bg-base-200 rounded-xl p-4">
          <div className="stat-title text-xs">Rechazados</div>
          <div className="stat-value text-error text-3xl">{rejected.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" className="tabs tabs-bordered mb-6">
        <input
          type="radio"
          name="clientes_tabs"
          role="tab"
          className="tab"
          aria-label={`Pendientes (${pending.length})`}
          defaultChecked
        />
        <div role="tabpanel" className="tab-content pt-6">
          <CustomerTable customers={pending} />
        </div>

        <input
          type="radio"
          name="clientes_tabs"
          role="tab"
          className="tab"
          aria-label={`Aprobados (${approved.length})`}
        />
        <div role="tabpanel" className="tab-content pt-6">
          <CustomerTable customers={approved} />
        </div>

        <input
          type="radio"
          name="clientes_tabs"
          role="tab"
          className="tab"
          aria-label={`Rechazados (${rejected.length})`}
        />
        <div role="tabpanel" className="tab-content pt-6">
          <CustomerTable customers={rejected} />
        </div>
      </div>
    </div>
  );
}
