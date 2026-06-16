import Link from "next/link";

export const metadata = {
  title: "Iniciar sesión — EQKOR Tienda",
};

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full bg-base-200 rounded-2xl p-8 shadow-sm text-center">
        <div className="text-4xl mb-4">🔑</div>
        <h1 className="text-2xl font-bold mb-2">Acceso al catálogo</h1>
        <p className="text-base-content/70 text-sm mb-6">
          Ingresa tu correo o número de WhatsApp para solicitar acceso al
          catálogo de precios y disponibilidad.
        </p>

        <div className="divider text-xs text-base-content/40">¿Nuevo aquí?</div>

        <Link href="/registro" className="btn btn-primary w-full mb-4">
          Solicitar acceso
        </Link>

        <div className="alert alert-info text-left text-sm p-3 rounded-xl">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            className="stroke-current shrink-0 w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            Si ya tienes acceso, usa el link que te enviamos por WhatsApp.
          </span>
        </div>
      </div>
    </div>
  );
}
