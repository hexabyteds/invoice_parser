import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import Hero from "../../components/landing/Hero";
import IntegrationsBand from "../../components/landing/IntegrationsBand";
import HowItWorks from "../../components/landing/HowItWorks";
import PricingTeaser from "../../components/landing/PricingTeaser";
import FAQ from "../../components/landing/FAQ";
import CTASection from "../../components/landing/CTASection";
import { useSeo, useJsonLd } from "../../hooks/useSeo";
import { SITE_URL } from "../../utils/seo";

const DESCRIPTION =
  "EazeeBooks uses AI to extract, structure, and export invoice data straight into QuickBooks and Zoho Books — no manual entry, no per-seat pricing. Built for UAE businesses.";

export default function Landing() {
  useSeo({
    title: "AI Invoice Processing & Bookkeeping Automation",
    description: DESCRIPTION,
    path: "/",
  });

  useJsonLd({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "EazeeBooks",
    url: SITE_URL,
    description: DESCRIPTION,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "AED",
      description: "Free plan — 50 AI-processed invoices per month",
    },
  });

  return (
    <main className="min-h-screen">

      {/* Fixed to the viewport (not the page) so the ambient glow stays
          visible in the side margins at every scroll position — without it,
          everything past the Hero sits on flat black and the margins read
          as empty dead space on wide/ultrawide screens. */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_15%,#4f46e522,transparent_38%),radial-gradient(circle_at_88%_20%,#7c3aed1c,transparent_38%),radial-gradient(circle_at_20%_85%,#7c3aed18,transparent_35%),radial-gradient(circle_at_85%_80%,#4f46e51c,transparent_35%)]" />

      <Navbar />

      <Hero />

      <IntegrationsBand />

      <HowItWorks />

      <PricingTeaser />

      <FAQ />

      <CTASection />

      <Footer />

    </main>
  );
}