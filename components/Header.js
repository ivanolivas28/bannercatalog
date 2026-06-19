"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ButtonSignin from "./ButtonSignin";
import config from "@/config";

const navLinks = [
  { href: "/#catalogo", label: "Catálogo" },
  { href: "/#marcas",   label: "Marcas" },
  { href: "/#contacto", label: "Contacto" },
];

const Header = () => {
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => setIsOpen(false), [searchParams]);

  return (
    <>
      {/* Top utility bar */}
      <div className="bg-neutral text-neutral-content text-xs py-2 hidden md:block">
        <div className="max-w-6xl mx-auto px-6 flex justify-between items-center">
          <div className="flex gap-6">
            <a href="tel:+526141980695" className="flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
              <i className="ti ti-phone text-sm" /> +52 614 198 0695
            </a>
            <a href="mailto:ventas@eqkor.mx" className="flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
              <i className="ti ti-mail text-sm" /> ventas@eqkor.mx
            </a>
          </div>
          <span className="flex items-center gap-1.5 opacity-50">
            <i className="ti ti-map-pin text-sm" /> Chihuahua, Chih. México
          </span>
        </div>
      </div>

      {/* Main header */}
      <header className="bg-base-100 border-b-[3px] border-primary shadow-sm sticky top-0 z-50">
        <nav className="max-w-6xl mx-auto px-6 flex items-center justify-between h-14">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <img src="/logo-engrane-sin-fondo.png" alt="EQKOR logo" className="w-9 h-9 object-contain" />
            <div className="leading-tight">
              <div className="font-bold text-sm text-base-content tracking-tight">
                {config.appName}
              </div>
              <div className="text-[9px] font-medium tracking-[1.5px] uppercase text-base-content/40">
                Tu proveedor industrial
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="px-3 py-2 rounded text-sm font-medium text-base-content/60 hover:text-base-content hover:bg-base-200 transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* CTA */}
          <div className="hidden lg:flex items-center gap-3">
            <ButtonSignin text="Iniciar sesión" extraStyle="btn-primary btn-sm" />
          </div>

          {/* Mobile burger */}
          <button
            className="lg:hidden btn btn-ghost btn-sm"
            onClick={() => setIsOpen(true)}
          >
            <i className="ti ti-menu-2 text-xl" />
          </button>
        </nav>

        {/* Mobile drawer */}
        {isOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 top-0 h-full w-72 bg-base-100 shadow-xl flex flex-col p-6 animate-appearFromRight">
              <div className="flex justify-between items-center mb-8">
                <span className="font-bold text-base-content">{config.appName}</span>
                <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setIsOpen(false)}>
                  <i className="ti ti-x text-lg" />
                </button>
              </div>
              <div className="flex flex-col gap-2 mb-8">
                {navLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="px-3 py-2.5 rounded text-sm font-medium text-base-content/70 hover:bg-base-200 hover:text-base-content transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
              <div className="border-t border-base-200 pt-6">
                <ButtonSignin text="Iniciar sesión" extraStyle="btn-primary btn-block" />
              </div>
              <div className="mt-auto pt-6 border-t border-base-200 text-xs text-base-content/40 flex flex-col gap-1">
                <a href="tel:+526141234567">+52 614 XXX XXXX</a>
                <span>Chihuahua, Chih. México</span>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
};

export default Header;
