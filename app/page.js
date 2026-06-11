import { Suspense } from "react";
import Header from "@/components/Header";
import CatalogPage from "@/components/CatalogPage";
import Footer from "@/components/Footer";

export const metadata = {
  title: "MVP Industrial — Automatización Industrial | Banner, Schneider, Turck, Wago",
  description:
    "Distribuidor de componentes de automatización industrial: sensores Banner Engineering, PLCs Schneider Electric, sensores Turck, terminales Wago. Stock en México y USA. Cotización inmediata.",
};

export default function Home() {
  return (
    <>
      <Suspense>
        <Header />
      </Suspense>
      <main>
        <CatalogPage />
      </main>
      <Footer />
    </>
  );
}
