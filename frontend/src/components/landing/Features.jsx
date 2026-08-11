import { motion } from "framer-motion";
import {
  FileText,
  Sparkles,
  Download,
  Users,
  BarChart3,
  ShieldCheck,
  Database,
  FileSpreadsheet,
  Receipt,
  Layers3,
} from "lucide-react";

import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import CTASection from "../../components/landing/CTASection";
import { useSeo } from "../../hooks/useSeo";

const liveFeatures = [
  {
    icon: Sparkles,
    title: "AI invoice extraction",
    description:
      "Upload a PDF or photo and turn it into structured invoice data and line items using Gemini 2.5 Flash.",
  },
  {
    icon: Download,
    title: "Multi-format export",
    description:
      "Export invoice data to Excel, CSV, PDF reports, QuickBooks, and Zoho Books for easier bookkeeping.",
  },
  {
    icon: Users,
    title: "Client workspace",
    description:
      "Keep invoices organized by client so businesses managing multiple vendors or business units stay separated.",
  },
  {
    icon: Layers3,
    title: "Multi-page PDF processing",
    description:
      "Process multi-page documents and PDFs containing multiple invoices without manually splitting every document.",
  },
  {
    icon: BarChart3,
    title: "Usage-based plans",
    description:
      "Plans control invoices, OCR pages, clients, storage, and team users so usage stays predictable.",
  },
  {
    icon: Database,
    title: "Invoice management",
    description:
      "Review extracted invoices, inspect source documents, update records, and manage your invoice history from one workspace.",
  },
];

const workflowFeatures = [
  {
    icon: FileText,
    title: "Structured invoice data",
    description:
      "Extract invoice numbers, dates, supplier and customer details, totals, taxes, currencies, and line items into structured records.",
  },
  {
    icon: FileSpreadsheet,
    title: "Accounting-ready exports",
    description:
      "Move processed invoice information into formats that fit your existing accounting and bookkeeping workflow.",
  },
  {
    icon: Receipt,
    title: "Invoice & OCR metering",
    description:
      "Track invoice and OCR usage against your subscription limits before processing more documents.",
  },
  {
    icon: ShieldCheck,
    title: "Secure account access",
    description:
      "Customer and administrator access is separated through authenticated accounts and role-based permissions.",
  },
];

function FeatureCard({ feature, index }) {
  const Icon = feature.icon;

  return (
    <motion.article
      initial={{
        opacity: 0,
        y: 18,
      }}
      whileInView={{
        opacity: 1,
        y: 0,
      }}
      viewport={{
        once: true,
        margin: "-80px",
      }}
      transition={{
        duration: 0.45,
        delay: index * 0.06,
      }}
      whileHover={{
        y: -3,
      }}
      className="
        group
        rounded-[22px]
        border
        border-slate-800
        bg-slate-900
        p-7
        transition-shadow
        duration-300
        hover:border-slate-700
        sm:p-8
      "
    >
      <div
        className="
          mb-7
          flex
          h-11
          w-11
          items-center
          justify-center
          rounded-xl
          border
          border-slate-700
          bg-slate-800
          text-indigo-400
          transition-transform
          duration-300
          group-hover:scale-105
        "
      >
        <Icon size={20} strokeWidth={1.7} />
      </div>

      <h3
        className="
          text-[21px]
          font-semibold
          tracking-[-0.025em]
          text-white
        "
      >
        {feature.title}
      </h3>

      <p
        className="
          mt-4
          text-[17px]
          leading-[1.7]
          tracking-[-0.01em]
          text-slate-400
        "
      >
        {feature.description}
      </p>
    </motion.article>
  );
}

export default function Features() {
  useSeo({
    title: "Features",
    description:
      "See how EazeeBooks extracts, structures, and exports invoice data with AI — upload, review, and send it straight into your accounting workflow.",
    path: "/features",
  });

  return (
    <main className="min-h-screen bg-[#030712] text-white">
      <Navbar />

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="mx-auto max-w-[1320px] px-6 pb-16 pt-32 sm:px-10 sm:pt-36 lg:px-14 lg:pb-20">
        <motion.div
          initial={{
            opacity: 0,
            y: 12,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.5,
          }}
        >
          <p
            className="
              text-sm
              font-semibold
              uppercase
              tracking-[0.2em]
              text-indigo-400
            "
          >
            Product
          </p>

          <h1
            className="
              mt-7
              max-w-4xl
              text-[44px]
              font-extrabold
              font-display
              leading-[1.05]
              tracking-[-0.02em]
              text-white
              sm:text-[56px]
              lg:text-[64px]
            "
          >
            Features
          </h1>

          <p
            className="
              mt-7
              max-w-[920px]
              text-lg
              leading-[1.7]
              text-slate-400
              sm:text-xl
            "
          >
            Everything you need to turn invoices into organized financial
            data. Upload documents, extract invoice details with AI, manage
            clients, and export the results into your accounting workflow.
          </p>
        </motion.div>
      </section>

      {/* =====================================================
          LIVE TODAY
      ===================================================== */}

      <section className="mx-auto max-w-[1320px] px-6 pb-24 sm:px-10 lg:px-14">
        <div className="mb-8 flex items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-green-400" />

          <h2
            className="
              text-[17px]
              font-bold
              uppercase
              tracking-[0.08em]
              text-slate-400
            "
          >
            Live today
          </h2>
        </div>

        <div
          className="
            grid
            grid-cols-1
            gap-6
            md:grid-cols-2
            lg:grid-cols-3
          "
        >
          {liveFeatures.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              feature={feature}
              index={index}
            />
          ))}
        </div>
      </section>

      {/* =====================================================
          WORKFLOW
      ===================================================== */}

      <section
        className="
          border-y
          border-slate-800
          bg-slate-950/60
        "
      >
        <div className="mx-auto max-w-[1320px] px-6 py-24 sm:px-10 lg:px-14">
          <div className="max-w-3xl">
            <p
              className="
                text-sm
                font-semibold
                uppercase
                tracking-[0.2em]
                text-indigo-400
              "
            >
              How it works
            </p>

            <h2
              className="
                mt-6
                text-4xl
                font-bold
                font-display
                tracking-tight
                leading-[1.08]
                text-white
                sm:text-5xl
              "
            >
              From document to usable data.
            </h2>

            <p
              className="
                mt-6
                text-lg
                leading-[1.7]
                text-slate-400
              "
            >
              Keep the process simple: upload an invoice, let AI extract the
              information, review the result, and export it wherever your
              bookkeeping process needs it.
            </p>
          </div>

          <div
            className="
              mt-14
              grid
              grid-cols-1
              gap-6
              md:grid-cols-2
              lg:grid-cols-4
            "
          >
            {workflowFeatures.map((feature, index) => (
              <FeatureCard
                key={feature.title}
                feature={feature}
                index={index}
              />
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          SIMPLE FLOW
      ===================================================== */}

      <section className="mx-auto max-w-[1320px] px-6 py-24 sm:px-10 lg:px-14">
        <p
          className="
            text-sm
            font-semibold
            uppercase
            tracking-[0.2em]
            text-indigo-400
          "
        >
          The workflow
        </p>

        <div
          className="
            mt-10
            grid
            grid-cols-1
            overflow-hidden
            rounded-3xl
            border
            border-slate-800
            bg-slate-900
            md:grid-cols-4
          "
        >
          {[
            ["01", "Upload", "PDF or image"],
            ["02", "Extract", "AI reads the invoice"],
            ["03", "Review", "Check structured data"],
            ["04", "Export", "Send it to your workflow"],
          ].map(([number, title, description], index) => (
            <motion.div
              key={number}
              initial={{
                opacity: 0,
                y: 15,
              }}
              whileInView={{
                opacity: 1,
                y: 0,
              }}
              viewport={{
                once: true,
              }}
              transition={{
                delay: index * 0.08,
              }}
              className={`
                p-7
                sm:p-9
                ${
                  index !== 3
                    ? "border-b border-slate-800 md:border-b-0 md:border-r"
                    : ""
                }
              `}
            >
              <span
                className="
                  font-mono
                  text-[12px]
                  tracking-[0.12em]
                  text-slate-500
                "
              >
                {number}
              </span>

              <h3
                className="
                  mt-5
                  text-[21px]
                  font-semibold
                  text-white
                "
              >
                {title}
              </h3>

              <p className="mt-3 text-[16px] text-slate-400">
                {description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      <CTASection />

      <Footer />
    </main>
  );
}
