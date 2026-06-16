"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function AccesoClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("loading"); // 'loading' | 'error'
  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    signIn("magic-token", { token, redirect: false }).then((result) => {
      if (result?.ok && !result?.error) {
        router.replace("/");
      } else {
        setStatus("error");
      }
    });
  }, [token, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <span className="loading loading-spinner loading-lg text-primary" />
        <p className="text-base-content/60 text-sm">Verificando acceso…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-sm w-full bg-base-200 rounded-2xl p-8 shadow-sm">
        <div className="text-4xl mb-4">🔒</div>
        <h1 className="text-xl font-bold mb-2">Link inválido o expirado</h1>
        <p className="text-base-content/70 text-sm mb-6">
          Este link de acceso ya no es válido. Puede que haya expirado o ya fue
          utilizado.
        </p>
        <p className="text-base-content/60 text-sm">
          Contacta a nuestro equipo de ventas:{" "}
          <a
            href="mailto:ventas@eqkor.mx"
            className="link link-primary font-medium"
          >
            ventas@eqkor.mx
          </a>
        </p>
      </div>
    </div>
  );
}
