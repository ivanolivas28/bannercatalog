import DashboardTimeline from "@/components/DashboardTimeline";
import MetricsDashboard from "@/components/MetricsDashboard";
import AlertPanel from "@/components/AlertPanel";

export const dynamic = "force-dynamic";

// IOTrack Dashboard - Vista principal con timeline estilo Grafana
export default async function Dashboard() {
  return (
    <main className="min-h-screen p-4 pb-24 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header con KPIs */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">🏭 IOTrack Dashboard</h1>
            <div className="flex space-x-2">
              <span className="badge badge-success text-white">Sistema Operativo</span>
              <span className="badge badge-primary text-white">Tiempo Real</span>
            </div>
          </div>
          <MetricsDashboard />
        </div>

        {/* Panel de Alertas Activas */}
        <AlertPanel />

        {/* Timeline Principal - Estados de máquinas */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">⚡ Estados de Máquinas - Timeline</h2>
          <DashboardTimeline />
        </div>

        {/* Acceso al perfil */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-center">
            <p className="text-gray-600 mb-4">Panel de administración del sistema</p>
            <div className="flex justify-center space-x-4">
              <button className="btn btn-primary">Gestión de Dispositivos</button>
              <button className="btn btn-secondary">Configurar Alertas</button>
              <button className="btn btn-accent">Reportes y Análisis</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
