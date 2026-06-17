"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("customer-password", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.ok && !result?.error) {
      router.replace(callbackUrl);
    } else {
      setError("Correo o contraseña incorrectos.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full bg-base-200 rounded-2xl p-8 shadow-sm">
        <div className="text-4xl mb-4 text-center">🔐</div>
        <h1 className="text-2xl font-bold mb-1 text-center">Iniciar sesión</h1>
        <p className="text-base-content/60 text-sm text-center mb-6">
          Accede al catálogo con tu correo y contraseña.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text text-sm font-medium">Correo empresarial</span>
            </label>
            <input
              type="email"
              className="input input-bordered w-full"
              placeholder="nombre@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text text-sm font-medium">Contraseña</span>
            </label>
            <input
              type="password"
              className="input input-bordered w-full"
              placeholder="Tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="alert alert-error text-sm p-3">
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn btn-primary w-full mt-2" disabled={loading}>
            {loading ? <span className="loading loading-spinner loading-sm" /> : "Entrar"}
          </button>
        </form>

        <div className="divider text-xs text-base-content/40 my-4">¿Sin cuenta?</div>

        <Link href="/registro" className="btn btn-outline w-full">
          Solicitar acceso
        </Link>

        <p className="text-xs text-base-content/40 text-center mt-4">
          Si ya tienes acceso aprobado, usa el link que te enviamos por WhatsApp para crear tu contraseña.
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><span className="loading loading-spinner loading-lg" /></div>}>
      <SignInContent />
    </Suspense>
  );
}
