import { Suspense } from "react";
import AccesoClient from "./AccesoClient";

export const metadata = {
  title: "Accediendo — EQKOR Tienda",
};

export default function AccesoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      }
    >
      <AccesoClient />
    </Suspense>
  );
}
