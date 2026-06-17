"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function AccesoClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [step, setStep] = useState("validating"); // validating | set-password | error | loading
  const [customerName, setCustomerName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setStep("error");
      return;
    }

    // Use magic-token provider to verify token is valid (without consuming it)
    fetch("/api/acceso/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) {
          setCustomerName(data.nombre);
          setStep("set-password");
        } else {
          setStep("error");
        }
      })
      .catch(() => setStep("error"));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (password.length < 8) {
      setErrorMsg("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setErrorMsg("Las contraseñas no coinciden.");
      return;
    }

    setStep("loading");

    // Save password and consume token
    const res = await fetch("/api/acceso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setErrorMsg(data.error || "Error al guardar la contraseña.");
      setStep("set-password");
      return;
    }

    // Auto login with new password
    const result = await signIn("customer-password", {
      email: data.email,
      password,
      redirect: false,
    });

    if (result?.ok && !result?.error) {
      router.replace("/");
    } else {
      setErrorMsg("Contraseña guardada. Inicia sesión con tu correo.");
      setStep("set-password");
    }
  };

  if (step === "validating") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <span className="loading loading-spinner loading-lg text-primary" />
        <p className="text-base-content/60 text-sm">Verificando link…</p>
      </div>
    );
  }

  if (step === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <span className="loading loading-spinner loading-lg text-primary" />
        <p className="text-base-content/60 text-sm">Guardando contraseña…</p>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-sm w-full bg-base-200 rounded-2xl p-8 shadow-sm">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold mb-2">Link inválido o expirado</h1>
          <p className="text-base-content/70 text-sm mb-6">
            Este link ya no es válido. Puede que haya expirado o ya fue utilizado.
          </p>
          <a href="/signin" className="btn btn-primary w-full">
            Iniciar sesión
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full bg-base-200 rounded-2xl p-8 shadow-sm">
        <div className="text-4xl mb-4 text-center">🔑</div>
        <h1 className="text-2xl font-bold mb-1 text-center">
          Bienvenido{customerName ? `, ${customerName}` : ""}
        </h1>
        <p className="text-base-content/60 text-sm text-center mb-6">
          Crea tu contraseña para acceder al catálogo.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text text-sm font-medium">Contraseña</span>
            </label>
            <input
              type="password"
              className="input input-bordered w-full"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoFocus
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text text-sm font-medium">Confirmar contraseña</span>
            </label>
            <input
              type="password"
              className="input input-bordered w-full"
              placeholder="Repite la contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>

          {errorMsg && (
            <div className="alert alert-error text-sm p-3">
              <span>{errorMsg}</span>
            </div>
          )}

          <button type="submit" className="btn btn-primary w-full mt-2">
            Crear contraseña y entrar
          </button>
        </form>
      </div>
    </div>
  );
}
