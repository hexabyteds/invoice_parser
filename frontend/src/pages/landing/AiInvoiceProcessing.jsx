import { Link } from "react-router-dom";
import { Sparkles, ScanText, Layers3, Receipt } from "lucide-react";

import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import CTASection from "../../components/landing/CTASection";
import { useSeo, useJsonLd } from "../../hooks/useSeo";
import { SITE_URL } from "../../utils/seo";

const DESCRIPTION =
  "How EazeeBooks' AI invoice processing works — upload a PDF or photo, Gemini 2.5 Flash extracts structured invoice data, and you review it before it's saved. No manual data entry, no separate OCR tool.";

export default function AiInvoiceProcessing() {
  useSeo({
    title: "AI Invoice Processing & Extraction",
    description: DESCRIPTION,
    path: "/ai-invoice-processing",
  });

  useJsonLd({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "EazeeBooks",
    url: `${SITE_URL}/ai-invoice-processing`,
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
          AI Invoice Processing
        </p>
        <h1 className="mt-4 text-4xl font-bold font-display tracking-tight sm:text-5xl">
          AI invoice processing, from upload to structured data
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
          Instead of typing invoice details in by hand or running a separate
          OCR tool, upload the document straight into EazeeBooks — AI does
          the extraction, you review the result.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/register"
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 font-semibold transition hover:opacity-90"
          >
            Try it — start your free trial
          </Link>
          <Link
            to="/invoicing-software"
            className="rounded-xl border border-slate-700 px-6 py-3 font-semibold text-slate-200 transition hover:border-slate-500"
          >
            See invoicing software
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16 sm:px-8">
        <h2 className="text-3xl font-bold font-display tracking-tight sm:text-4xl">
          What the AI actually extracts
        </h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <div>
            <Sparkles className="text-indigo-400" size={28} />
            <h3 className="mt-4 text-xl font-semibold">
              Built on Gemini 2.5 Flash
            </h3>
            <p className="mt-2 text-slate-400">
              A PDF or photo of an invoice is read directly by Google's
              Gemini 2.5 Flash model — no template setup, no training your
              own model on your invoice layouts first.
            </p>
          </div>
          <div>
            <ScanText className="text-indigo-400" size={28} />
            <h3 className="mt-4 text-xl font-semibold">
              Full structured extraction
            </h3>
            <p className="mt-2 text-slate-400">
              Invoice number, date, supplier and customer details, totals,
              taxes, currency, and every line item come out as structured
              data — not just a block of recognized text.
            </p>
          </div>
          <div>
            <Layers3 className="text-indigo-400" size={28} />
            <h3 className="mt-4 text-xl font-semibold">
              Multi-page documents, handled in one pass
            </h3>
            <p className="mt-2 text-slate-400">
              A single PDF containing several invoices is split and each one
              processed on its own — you don't separate them first.
            </p>
          </div>
          <div>
            <Receipt className="text-indigo-400" size={28} />
            <h3 className="mt-4 text-xl font-semibold">
              Review before it's saved
            </h3>
            <p className="mt-2 text-slate-400">
              Extracted data is shown for review before it's committed, so
              you catch anything the AI got wrong before it reaches your
              books — usage against your plan's OCR/invoice limits is
              tracked as you go.
            </p>
          </div>
        </div>

        <p className="mt-12 text-slate-400">
          Once the data's extracted, it fits into the rest of your
          bookkeeping — see how on the{" "}
          <Link to="/invoicing-software" className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300">
            invoicing software
          </Link>{" "}
          page, or zoom out to the full{" "}
          <Link to="/accounting-software" className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300">
            accounting software
          </Link>{" "}
          picture.
        </p>
      </section>

      <CTASection />
      <Footer />
    </main>
  );
}
