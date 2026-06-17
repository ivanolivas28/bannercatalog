"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import config from "@/config";

const Footer = () => {
  return (
    <footer className="bg-neutral text-neutral-content">
      <div className="max-w-6xl mx-auto px-6 pt-12 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pb-10 border-b border-white/10">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-lg">
                ⬡
              </div>
              <span className="font-bold text-white">{config.appName}</span>
            </div>
            <p className="text-sm text-neutral-content/50 leading-relaxed max-w-xs">
              Distribuidor especializado en componentes de automatización industrial.
              Stock disponible en México, cotización inmediata y envío a todo el país.
            </p>
          </div>

          {/* Marcas */}
          <div>
            <h4 className="text-xs font-bold tracking-[1.5px] uppercase text-white/80 mb-4">
              Marcas
            </h4>
            <div className="flex flex-col gap-2 text-sm text-neutral-content/50">
              <Link href="/#catalogo" className="hover:text-white transition-colors">Banner Engineering</Link>
              <Link href="/#catalogo" className="hover:text-white transition-colors">Schneider Electric</Link>
              <Link href="/#catalogo" className="hover:text-white transition-colors">Turck</Link>
              <Link href="/#catalogo" className="hover:text-white transition-colors">Wago</Link>
            </div>
          </div>

          {/* Contacto */}
          <div>
            <h4 className="text-xs font-bold tracking-[1.5px] uppercase text-white/80 mb-4">
              Contacto
            </h4>
            <div className="flex flex-col gap-2.5 text-sm text-neutral-content/50">
              <a href="tel:+526141234567" className="flex items-center gap-2 hover:text-white transition-colors">
                <i className="ti ti-phone text-base opacity-60" /> +52 614 XXX XXXX
              </a>
              <a href="mailto:ventas@TU-DOMINIO.com" className="flex items-center gap-2 hover:text-white transition-colors">
                <i className="ti ti-mail text-base opacity-60" /> ventas@TU-DOMINIO.com
              </a>
              <span className="flex items-center gap-2">
                <i className="ti ti-map-pin text-base opacity-60" /> Chihuahua, Chih. México
              </span>
              <a
                href={`https://wa.me/5261400000000`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <i className="ti ti-brand-whatsapp text-base opacity-60" /> WhatsApp directo
              </a>
            </div>
          </div>
        </div>

        <div className="pt-5 flex flex-col md:flex-row justify-between items-center gap-2 text-xs text-neutral-content/25">
          <span>© {new Date().getFullYear()} {config.appName} · Chihuahua, México · Todos los derechos reservados.</span>
          <div className="flex items-center gap-3">
            <span>Banner Engineering · Schneider Electric · Turck · Wago</span>
            <button
              onClick={() => signIn("google", { callbackUrl: "/admin/clientes" })}
              className="opacity-20 hover:opacity-60 transition-opacity"
              title="Admin"
            >
              🔒
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
