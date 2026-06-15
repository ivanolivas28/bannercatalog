"use client";

import { useState } from "react";

export default function RegistroPage() {
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    empresa: "",
    email: "",
    whatsapp: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ocurrió un error. Intenta de nuevo.");
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: "#0f2028" }}
      >
        <div className="max-w-md w-full text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">
            ¡Solicitud enviada!
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Tu solicitud está en revisión. Te avisaremos pronto por correo.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: "#0f2028" }}
    >
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Solicitud de acceso
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Accede al catálogo completo con precios y tiempos de entrega.
            Completa tu información y te activaremos en breve.
          </p>
        </div>

        {/* Form card */}
        <div
          className="rounded-2xl p-6 sm:p-8 shadow-xl"
          style={{ backgroundColor: "#162535", border: "1px solid #1e3a4a" }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  required
                  placeholder="Juan"
                  className="w-full rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ backgroundColor: "#0f2028", border: "1px solid #1e3a4a" }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Apellido
                </label>
                <input
                  type="text"
                  name="apellido"
                  value={form.apellido}
                  onChange={handleChange}
                  required
                  placeholder="García"
                  className="w-full rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ backgroundColor: "#0f2028", border: "1px solid #1e3a4a" }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Empresa
              </label>
              <input
                type="text"
                name="empresa"
                value={form.empresa}
                onChange={handleChange}
                required
                placeholder="Industrias Ejemplo S.A. de C.V."
                className="w-full rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ backgroundColor: "#0f2028", border: "1px solid #1e3a4a" }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Correo corporativo
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="juan@empresa.com"
                className="w-full rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ backgroundColor: "#0f2028", border: "1px solid #1e3a4a" }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                WhatsApp
              </label>
              <input
                type="tel"
                name="whatsapp"
                value={form.whatsapp}
                onChange={handleChange}
                required
                placeholder="+52 55 1234 5678"
                className="w-full rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ backgroundColor: "#0f2028", border: "1px solid #1e3a4a" }}
              />
            </div>

            {error && (
              <div className="rounded-lg px-4 py-3 text-sm text-red-300 bg-red-900/30 border border-red-800">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 rounded-lg font-semibold text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#1c84be" }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  Enviando...
                </span>
              ) : (
                "Solicitar acceso"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          ¿Ya tienes acceso?{" "}
          <a href="/api/auth/signin" className="text-blue-400 hover:underline">
            Inicia sesión
          </a>
        </p>
      </div>
    </main>
  );
}
