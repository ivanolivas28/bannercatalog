"use client";

import { useEffect, useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";

function VerifyMagicContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("verifying"); // verifying | error

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      return;
    }

    signIn("magic-token", {
      token,
      redirect: false,
    }).then((result) => {
      if (result?.ok && !result?.error) {
        router.push("/");
      } else {
        router.push("/signin?error=token_invalid");
      }
    });
  }, [searchParams, router]);

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "#0f2028" }}
    >
      <div className="text-center">
        {status === "verifying" ? (
          <>
            <div className="flex justify-center mb-4">
              <svg
                className="animate-spin w-10 h-10 text-blue-400"
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
            </div>
            <p className="text-white text-lg font-medium">Verificando enlace...</p>
            <p className="text-slate-400 text-sm mt-2">Serás redirigido en un momento.</p>
          </>
        ) : (
          <>
            <p className="text-red-400 text-lg font-medium">Enlace no válido</p>
            <a href="/signin" className="text-blue-400 hover:underline text-sm mt-3 inline-block">
              Volver al inicio de sesión
            </a>
          </>
        )}
      </div>
    </main>
  );
}

export default function VerifyMagicPage() {
  return (
    <Suspense fallback={null}>
      <VerifyMagicContent />
    </Suspense>
  );
}
