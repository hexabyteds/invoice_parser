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
  "EazeeBooks uses AI to extract, structure, and export invoice data straight into QuickBooks, Zoho, and Xero — no manual entry, no per-seat pricing. Built for UAE businesses.";

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
    <main className="min-h-screen bg-[#030712]">

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