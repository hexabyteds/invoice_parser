import { Link } from "react-router-dom";
import { Sparkles, Download, Users, ShieldCheck } from "lucide-react";

import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import CTASection from "../../components/landing/CTASection";
import { useSeo, useJsonLd } from "../../hooks/useSeo";
import { SITE_URL } from "../../utils/seo";

const DESCRIPTION =
  "EazeeBooks is AI-powered accounting software for UAE businesses and freelancers — extract invoice data automatically, track customers and suppliers, and export straight into QuickBooks or Zoho Books.";

export default function AccountingSoftware() {
  useSeo({
    title: "Accounting Software for UAE Businesses",
    description: DESCRIPTION,
    path: "/accounting-software",
  });

  useJsonLd({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "EazeeBooks",
    url: `${SITE_URL}/accounting-software`,
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
          Accounting Software
        </p>
        <h1 className="mt-4 text-4xl font-bold font-display tracking-tight sm:text-5xl">
          Accounting software built for how UAE businesses actually work
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
          EazeeBooks pairs AI invoice extraction with straightforward customer,
          supplier, and document management — priced in AED, built for
          businesses and freelancers working across one or several companies.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/register"
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 font-semibold transition hover:opacity-90"
          >
            Start your 7-day free trial
          </Link>
          <Link
            to="/price"
            className="rounded-xl border border-slate-700 px-6 py-3 font-semibold text-slate-200 transition hover:border-slate-500"
          >
            View pricing
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16 sm:px-8">
        <h2 className="text-3xl font-bold font-display tracking-tight sm:text-4xl">
          What makes it accounting software, not just an invoice tool
        </h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <div>
            <Sparkles className="text-indigo-400" size={28} />
            <h3 className="mt-4 text-xl font-semibold">AI invoice extraction</h3>
            <p className="mt-2 text-slate-400">
              Upload a PDF or photo and EazeeBooks turns it into structured
              invoice data — numbers, dates, supplier and customer details,
              totals, taxes, and line items — without manual entry.
            </p>
          </div>
          <div>
            <Users className="text-indigo-400" size={28} />
            <h3 className="mt-4 text-xl font-semibold">
              Customers, suppliers, and companies in one workspace
            </h3>
            <p className="mt-2 text-slate-400">
              Track customers and suppliers separately, keep bills and
              invoices organized by party, and — for freelancers managing
              more than one business — switch between companies without
              losing track of which books belong where.
            </p>
          </div>
          <div>
            <Download className="text-indigo-400" size={28} />
            <h3 className="mt-4 text-xl font-semibold">
              Export into your existing bookkeeping workflow
            </h3>
            <p className="mt-2 text-slate-400">
              Move processed data into QuickBooks or Zoho Books directly, or
              export to Excel/CSV/PDF for any other accounting process you
              already use.
            </p>
          </div>
          <div>
            <ShieldCheck className="text-indigo-400" size={28} />
            <h3 className="mt-4 text-xl font-semibold">
              Role-based access, AED pricing, UAE VAT
            </h3>
            <p className="mt-2 text-slate-400">
              Customer and administrator access are kept separate through
              authenticated, role-based permissions. Plans are priced in AED
              with UAE VAT itemized at checkout.
            </p>
          </div>
        </div>

        <p className="mt-12 text-slate-400">
          Looking for the invoicing side specifically? See{" "}
          <Link to="/invoicing-software" className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300">
            EazeeBooks as invoicing software
          </Link>{" "}
          or read more about{" "}
          <Link to="/ai-invoice-processing" className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300">
            how the AI invoice processing works
          </Link>
          . For the full feature list, see{" "}
          <Link to="/features" className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300">
            Features
          </Link>
          .
        </p>
      </section>

      <CTASection />
      <Footer />
    </main>
  );
}
