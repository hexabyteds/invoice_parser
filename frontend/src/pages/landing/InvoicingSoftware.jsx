import { Link } from "react-router-dom";
import { FileText, Layers3, Receipt, FileSpreadsheet } from "lucide-react";

import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import CTASection from "../../components/landing/CTASection";
import { useSeo, useJsonLd } from "../../hooks/useSeo";
import { SITE_URL } from "../../utils/seo";

const DESCRIPTION =
  "Invoicing software that reads your invoices for you. EazeeBooks extracts invoice numbers, dates, totals, taxes, and line items from PDFs and photos automatically, then keeps every invoice organized by customer or supplier.";

export default function InvoicingSoftware() {
  useSeo({
    title: "Invoicing Software with AI Data Extraction",
    description: DESCRIPTION,
    path: "/invoicing-software",
  });

  useJsonLd({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "EazeeBooks",
    url: `${SITE_URL}/invoicing-software`,
    description: DESCRIPTION,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "AED",
      description: "Free plan, then paid plans priced in AED — see /price for current limits.",
    },
  });

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <Navbar />

      <section className="mx-auto max-w-4xl px-6 pb-16 pt-32 text-center sm:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-400">
          Invoicing Software
        </p>
        <h1 className="mt-4 text-4xl font-bold font-display tracking-tight sm:text-5xl">
          Invoicing software that reads invoices, not just stores them
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
          Most invoicing tools make you type everything in by hand.
          EazeeBooks extracts the data straight from the document — invoice
          and bill alike — so the only thing left to do is review it.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/register"
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 font-semibold transition hover:opacity-90"
          >
            Start your 7-day free trial
          </Link>
          <Link
            to="/features"
            className="rounded-xl border border-slate-700 px-6 py-3 font-semibold text-slate-200 transition hover:border-slate-500"
          >
            See all features
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16 sm:px-8">
        <h2 className="text-3xl font-bold font-display tracking-tight sm:text-4xl">
          How invoice management works in EazeeBooks
        </h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <div>
            <FileText className="text-indigo-400" size={28} />
            <h3 className="mt-4 text-xl font-semibold">
              Structured data from every invoice
            </h3>
            <p className="mt-2 text-slate-400">
              Invoice numbers, dates, supplier and customer details, totals,
              taxes, currencies, and line items are all extracted into
              structured records you can review and correct.
            </p>
          </div>
          <div>
            <Layers3 className="text-indigo-400" size={28} />
            <h3 className="mt-4 text-xl font-semibold">
              Multi-page PDFs handled automatically
            </h3>
            <p className="mt-2 text-slate-400">
              Upload a PDF containing several invoices and EazeeBooks splits
              and processes each one — no manual separation required first.
            </p>
          </div>
          <div>
            <Receipt className="text-indigo-400" size={28} />
            <h3 className="mt-4 text-xl font-semibold">
              Invoices and bills, kept separate
            </h3>
            <p className="mt-2 text-slate-400">
              Customer invoices and supplier bills are tracked as distinct
              document types, each linked to the right party, so your
              receivables and payables never get mixed together.
            </p>
          </div>
          <div>
            <FileSpreadsheet className="text-indigo-400" size={28} />
            <h3 className="mt-4 text-xl font-semibold">
              Export when you're ready
            </h3>
            <p className="mt-2 text-slate-400">
              Send processed invoice data to QuickBooks or Zoho Books, or
              export to Excel, CSV, or PDF for any other workflow you run
              alongside EazeeBooks.
            </p>
          </div>
        </div>

        <p className="mt-12 text-slate-400">
          Curious how the extraction itself works? Read{" "}
          <Link to="/ai-invoice-processing" className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300">
            how AI invoice processing works
          </Link>
          , or see the bigger picture on the{" "}
          <Link to="/accounting-software" className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300">
            accounting software
          </Link>{" "}
          page.
        </p>
      </section>

      <CTASection />
      <Footer />
    </main>
  );
}
