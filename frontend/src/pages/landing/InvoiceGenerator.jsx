import { useEffect } from "react";
import { Link } from "react-router-dom";

import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import CTASection from "../../components/landing/CTASection";
import InvoiceGeneratorTool from "../../components/invoiceGenerator/InvoiceGeneratorTool";
import { useSeo, useJsonLd } from "../../hooks/useSeo";
import { SITE_URL } from "../../utils/seo";

const DESCRIPTION =
  "Create professional invoices online with automatic UAE VAT calculations. Download your invoice as a PDF — no signup required.";

const FAQS = [
  {
    q: "Is this invoice generator really free?",
    a: "Yes. You can create and download as many invoices as you like without signing up or paying. There's no watermark and no download limit.",
  },
  {
    q: "Do I need to create an account?",
    a: "No — you can fill in the form and download a PDF invoice with no account at all. Creating a free EazeeBooks account is only needed if you want to save, edit, or track invoices later.",
  },
  {
    q: "Does it handle UAE VAT?",
    a: "Yes. You can apply the standard 5% UAE VAT rate, 0% for VAT-exempt items, and choose whether your prices already include VAT or VAT should be added on top. You can also add your business and customer TRN (Tax Registration Number).",
  },
  {
    q: "Is my invoice data saved anywhere?",
    a: "No. Nothing you enter is stored on our servers — the PDF is generated on demand and your data isn't kept afterward, unless you choose to create an EazeeBooks account to save and manage invoices going forward.",
  },
  {
    q: "Can I use this for multiple customers or recurring invoices?",
    a: "The free generator creates one invoice at a time with no saved history. For recurring invoicing, customer records, and invoice tracking across many clients, EazeeBooks' full accounting software is built for exactly that.",
  },
];

export default function InvoiceGenerator() {
  useSeo({
    title: "Free Invoice Generator",
    description: DESCRIPTION,
    path: "/invoice-generator",
  });

  useJsonLd({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "EazeeBooks Free Invoice Generator",
    url: `${SITE_URL}/invoice-generator`,
    description: DESCRIPTION,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "AED",
    },
  });

  useJsonLd({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  });

  useEffect(() => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "invoice_generator_view" });
  }, []);

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <Navbar />

      <section className="mx-auto max-w-6xl px-6 pb-10 pt-28 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-400">
            Free Tool
          </p>
          <h1 className="mt-4 text-4xl font-bold font-display tracking-tight sm:text-5xl">
            Free Invoice Generator
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
            {DESCRIPTION}
          </p>
        </div>

        <div className="mt-10">
          <InvoiceGeneratorTool />
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
        <h2 className="text-3xl font-bold font-display tracking-tight sm:text-4xl">
          How to create an invoice
        </h2>
        <ol className="mt-6 space-y-3 text-slate-400">
          <li><span className="font-semibold text-slate-200">1. Add your business details.</span> Name, TRN, and contact details appear on every invoice.</li>
          <li><span className="font-semibold text-slate-200">2. Add your customer's details.</span> Name or company name is required; the rest is optional.</li>
          <li><span className="font-semibold text-slate-200">3. Add line items.</span> Description, quantity, and price — add as many as you need.</li>
          <li><span className="font-semibold text-slate-200">4. Set your VAT rate.</span> 5% is the UAE standard; 0% for VAT-exempt work.</li>
          <li><span className="font-semibold text-slate-200">5. Download the PDF.</span> Your invoice is ready to send — no signup required.</li>
        </ol>

        <h2 className="mt-14 text-3xl font-bold font-display tracking-tight sm:text-4xl">
          What should a UAE VAT invoice include?
        </h2>
        <p className="mt-4 text-slate-400">
          A valid UAE tax invoice generally includes: the words "Tax Invoice," your business
          name and TRN, the customer's name (and TRN, for B2B invoices over the mandatory
          threshold), a unique invoice number, the invoice date, a description and price for
          each line item, the VAT rate applied, the VAT amount, and the total amount payable
          in AED. This generator includes all of these fields by default.
        </p>
        <p className="mt-4 text-sm text-slate-500">
          This is general guidance, not tax advice — confirm specific requirements for your
          business with the UAE Federal Tax Authority or your accountant.
        </p>

        <h2 className="mt-14 text-3xl font-bold font-display tracking-tight sm:text-4xl">
          Frequently asked questions
        </h2>
        <div className="mt-6 space-y-6">
          {FAQS.map(({ q, a }) => (
            <div key={q}>
              <p className="font-semibold text-slate-100">{q}</p>
              <p className="mt-1 text-slate-400">{a}</p>
            </div>
          ))}
        </div>

        <p className="mt-14 text-slate-400">
          Need to track invoices across multiple customers, manage suppliers, or keep a full
          record of your bookkeeping? See{" "}
          <Link to="/accounting-software" className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300">
            EazeeBooks accounting software for UAE businesses
          </Link>{" "}
          or read how{" "}
          <Link to="/ai-invoice-processing" className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300">
            AI invoice processing
          </Link>{" "}
          handles invoices you receive, not just ones you send.
        </p>
      </section>

      <CTASection />
      <Footer />
    </main>
  );
}
