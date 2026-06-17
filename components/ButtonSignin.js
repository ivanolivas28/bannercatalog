/* eslint-disable @next/next/no-img-element */
"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import config from "@/config";

const ButtonSignin = ({ text = "Iniciar sesión", extraStyle }) => {
  const router = useRouter();
  const { data: session, status } = useSession();

  if (status === "authenticated") {
    const initial = session.user?.name?.charAt(0) || session.user?.email?.charAt(0) || "?";
    const displayName = session.user?.name || session.user?.email || "Mi cuenta";

    return (
      <div className="dropdown dropdown-end">
        <label tabIndex={0} className={`btn ${extraStyle ?? ""} gap-2`}>
          {session.user?.image ? (
            <img
              src={session.user.image}
              alt={displayName}
              className="w-6 h-6 rounded-full shrink-0"
              referrerPolicy="no-referrer"
              width={24}
              height={24}
            />
          ) : (
            <span className="w-6 h-6 bg-primary/20 text-primary flex items-center justify-center rounded-full shrink-0 font-semibold text-xs">
              {initial.toUpperCase()}
            </span>
          )}
          <span className="max-w-[120px] truncate">{displayName}</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 opacity-50" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </label>
        <ul tabIndex={0} className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-xl w-52 mt-1 border border-base-200 z-[100]">
          <li className="menu-title px-3 py-1">
            <span className="text-xs text-base-content/50 truncate">{session.user?.email}</span>
          </li>
          {session.user?.isAdmin && (
            <li>
              <Link href="/admin/clientes" className="text-sm">
                Panel admin
              </Link>
            </li>
          )}
          <li>
            <button
              onClick={() => signOut({ callbackUrl: "/signin" })}
              className="text-sm text-error"
            >
              Cerrar sesión
            </button>
          </li>
        </ul>
      </div>
    );
  }

  return (
    <button
      className={`btn ${extraStyle ?? ""}`}
      onClick={() => router.push("/signin")}
    >
      {text}
    </button>
  );
};

export default ButtonSignin;
