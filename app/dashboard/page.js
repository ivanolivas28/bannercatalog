"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";

export default function DashboardPage() {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [taskRes, statsRes] = await Promise.all([
        fetch("/api/tracker/tasks?status=pending&limit=50"),
        fetch("/api/tracker/stats"),
      ]);

      const taskData = await taskRes.json();
      const statsData = await statsRes.json();

      if (taskData.success) setTasks(taskData.data.tasks || []);
      if (statsData.success) setStats(statsData.data);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error cargando datos");
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    try {
      setSyncLoading(true);
      const res = await fetch("/api/tracker/sync", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        toast.success(
          `✅ ${data.data.tasksCreated} tareas creadas, ${data.data.customersCount} clientes`
        );
        await fetchData();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error("Error sincronizando");
    } finally {
      setSyncLoading(false);
    }
  }

  async function completeTask(taskId) {
    try {
      await fetch("/api/tracker/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status: "completed" }),
      });
      setTasks(tasks.filter(t => t._id !== taskId));
      toast.success("✅ Hecho!");
    } catch {
      toast.error("Error");
    }
  }

  if (!stats) return <div className="p-4 text-center">Cargando...</div>;

  const urgentTasks = tasks.filter(t => t.priority === "urgent");
  const highTasks = tasks.filter(t => t.priority === "high");
  const mediumTasks = tasks.filter(t => t.priority === "medium");

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">📊 Sales Tracker</h1>
            <p className="text-gray-600 mt-1">Tu copiloto de prospección</p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncLoading}
            className="btn btn-primary btn-lg"
          >
            {syncLoading ? "Sincronizando..." : "🔄 Sincronizar"}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <div className="stat bg-red-500 text-white rounded-lg">
            <div className="text-2xl">🔴</div>
            <div className="stat-value text-3xl">{stats.tasks.today}</div>
            <div className="stat-desc text-white text-opacity-80">Hoy</div>
          </div>
          <div className="stat bg-orange-500 text-white rounded-lg">
            <div className="text-2xl">🟠</div>
            <div className="stat-value text-3xl">{stats.tasks.thisWeek}</div>
            <div className="stat-desc text-white text-opacity-80">Esta semana</div>
          </div>
          <div className="stat bg-yellow-500 text-white rounded-lg">
            <div className="text-2xl">⭐</div>
            <div className="stat-value text-3xl">{stats.customers.vipActive}</div>
            <div className="stat-desc text-white text-opacity-80">VIP Activos</div>
          </div>
          <div className="stat bg-purple-500 text-white rounded-lg">
            <div className="text-2xl">⚠️</div>
            <div className="stat-value text-3xl">{stats.customers.atRisk}</div>
            <div className="stat-desc text-white text-opacity-80">En Riesgo</div>
          </div>
          <div className="stat bg-green-500 text-white rounded-lg">
            <div className="text-2xl">📧</div>
            <div className="stat-value text-3xl">{stats.email.openRate}%</div>
            <div className="stat-desc text-white text-opacity-80">Email Rate</div>
          </div>
        </div>

        {/* Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {urgentTasks.length > 0 && (
              <TaskGroup title="🔴 URGENTE" tasks={urgentTasks} onComplete={completeTask} />
            )}
            {highTasks.length > 0 && (
              <TaskGroup title="🟠 HOY" tasks={highTasks} onComplete={completeTask} />
            )}
            {mediumTasks.length > 0 && (
              <TaskGroup title="🟡 ESTA SEMANA" tasks={mediumTasks} onComplete={completeTask} />
            )}
            {tasks.length === 0 && (
              <div className="alert alert-success">✅ ¡Sin tareas! Excelente trabajo</div>
            )}
          </div>

          <div className="space-y-4">
            <div className="card bg-white shadow-lg">
              <div className="card-body">
                <h3 className="card-title">👥 Segmentos</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>VIP Activos</span>
                    <span className="badge">{stats.customers.vipActive}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Activos</span>
                    <span className="badge">{stats.customers.active}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>En Riesgo</span>
                    <span className="badge">{stats.customers.atRisk}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dormidos</span>
                    <span className="badge">{stats.customers.dormant}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-white shadow-lg">
              <div className="card-body">
                <h3 className="card-title">💰 Top Clientes</h3>
                {stats.activity.topCustomers.map((c, i) => (
                  <div key={i} className="text-sm border-b pb-2">
                    <p className="font-bold truncate">{c.empresa}</p>
                    <p className="text-gray-600">${(c.totalSpent || 0).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskGroup({ title, tasks, onComplete }) {
  return (
    <div className="card bg-white shadow-lg">
      <div className="card-body">
        <h2 className="card-title text-lg mb-4">{title}</h2>
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task._id} className="border-l-4 border-blue-500 p-3 hover:bg-blue-50 rounded">
              <div className="flex justify-between">
                <div className="flex-1">
                  <p className="font-bold">{task.title}</p>
                  <p className="text-sm text-gray-600">{task.customer?.empresa}</p>
                  {task.suggestedAction && (
                    <p className="text-xs bg-blue-100 p-2 rounded mt-1 italic">{task.suggestedAction}</p>
                  )}
                </div>
                <button
                  onClick={() => onComplete(task._id)}
                  className="btn btn-sm btn-success"
                >
                  ✓
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
