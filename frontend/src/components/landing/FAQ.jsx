import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useJsonLd } from "../../hooks/useSeo";

const faqs = [
  {
    q: "Is there a free trial?",
    a: "Yes — every new account starts with a 7-day free trial with full access, no credit card required. After the trial, your account and data stay fully accessible; you'll just need to upgrade to keep creating and uploading new invoices.",
  },
  {
    q: "What file formats can I upload?",
    a: "PDF and common image formats (JPG, PNG) — including multi-page PDFs containing more than one invoice, which are split and processed automatically.",
  },
  {
    q: "What happens if I go over my plan's monthly invoice limit?",
    a: "You'll get a warning as you approach your limit. You can upgrade at any time to a higher plan — processing doesn't stop mid-month without notice.",
  },
  {
    q: "Is my invoice and financial data secure?",
    a: "Data is encrypted in transit over SSL. Access to your account is separated by authenticated, role-based permissions between customer and administrator accounts.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Paid plans are month-to-month (or annual, if you choose yearly billing) with no long-term contract.",
  },
  {
    q: "Do you support AED pricing and UAE VAT?",
    a: "Yes — plans are priced in AED. Displayed prices exclude the standard 5% UAE VAT, which is itemized at checkout.",
  },
  {
    q: "Which accounting platforms can I export to?",
    a: "QuickBooks and Zoho Books are supported directly, alongside Excel and CSV export for any other workflow.",
  },
];

function FAQItem({ item, isOpen, onToggle }) {
  return (
    <div className="border-b border-slate-800 py-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <span className="text-lg font-medium text-white">{item.q}</span>
        <ChevronDown
          size={20}
          className={`shrink-0 text-slate-500 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <p className="pb-5 pr-8 text-slate-400">{item.a}</p>
      )}
    </div>
  );
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  // Built directly from the real Q&As above — no invented questions, so
  // this genuinely qualifies as FAQPage content per Google's guidelines.
  useJsonLd({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  });

  return (
    <section className="mx-auto max-w-4xl px-6 py-24 sm:px-8">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-400">
          FAQ
        </p>
        <h2 className="mt-4 text-4xl font-bold font-display tracking-tight text-white sm:text-5xl">
          Questions, answered.
        </h2>
      </div>

      <div className="mt-12">
        {faqs.map((item, index) => (
          <FAQItem
            key={item.q}
            item={item}
            isOpen={openIndex === index}
            onToggle={() => setOpenIndex(openIndex === index ? -1 : index)}
          />
        ))}
      </div>
    </section>
  );
}
