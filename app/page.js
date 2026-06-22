import { Suspense } from "react";
import Header from "@/components/Header";
import CatalogPage from "@/components/CatalogPage";
import Footer from "@/components/Footer";

export const metadata = {
  title: "EQKOR — Proveedor de Automatización Industrial en Chihuahua, México | Banner, Schneider, Turck, Wago",
  description:
    "Distribuidor de componentes de automatización industrial en Chihuahua y toda la República Mexicana. Sensores Banner Engineering, PLCs Schneider Electric, sensores Turck, terminales Wago. Stock disponible en México. Cotización en menos de 2 horas.",
  keywords: [
    "automatización industrial Chihuahua",
    "sensores industriales México",
    "distribuidor Banner Engineering México",
    "Schneider Electric Chihuahua",
    "sensores Turck México",
    "terminales WAGO México",
    "PLCs industriales Chihuahua",
    "componentes automatización Chihuahua",
    "proveedor industrial Chihuahua",
    "variadores de velocidad México",
    "stock sensores industriales México",
    "cotización componentes industriales",
  ],
  openGraph: {
    title: "EQKOR — Proveedor de Automatización Industrial en Chihuahua, México",
    description:
      "Distribuidor de Banner Engineering, Schneider Electric, Turck y Wago. Stock en México. Cotización en menos de 2 horas. Envío a toda la República.",
    url: "https://tienda.eqkor.mx",
    siteName: "EQKOR Industrial",
    locale: "es_MX",
    type: "website",
  },
};

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "EQKOR Industrial",
  description: "Distribuidor de componentes de automatización industrial: Banner Engineering, Schneider Electric, Turck, Wago. Stock en México.",
  url: "https://tienda.eqkor.mx",
  logo: "https://tienda.eqkor.mx/logo-engrane-sin-fondo.png",
  image: "https://tienda.eqkor.mx/logo-engrane-sin-fondo.png",
  telephone: "+52-614-198-0695",
  email: "ventas@eqkor.mx",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Av. Francisco Villa 6501 Int. 106, Las Granjas",
    addressLocality: "Chihuahua",
    addressRegion: "Chihuahua",
    postalCode: "31100",
    addressCountry: "MX",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 28.6353,
    longitude: -106.0889,
  },
  areaServed: {
    "@type": "Country",
    name: "México",
  },
  sameAs: [
    "https://www.facebook.com/eqkor.ind",
    "https://www.instagram.com/eqkor.automatizacion",
    "https://eqkor.mx",
  ],
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    opens: "08:00",
    closes: "18:00",
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
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
