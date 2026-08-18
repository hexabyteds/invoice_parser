import { Mail, Phone } from "lucide-react";

import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import { useSeo } from "../../hooks/useSeo";
import { TERMS_META, TERMS_SECTIONS } from "../../data/termsContent";

function Block({ block }) {
  if (block.p) {
    return (
      <p className={block.caps ? "font-medium tracking-tight" : undefined}>
        {block.strong ? <strong>{block.p}</strong> : block.p}
      </p>
    );
  }

  if (block.ul) {
    return (
      <ul>
        {block.ul.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }

  if (block.ol) {
    return (
      <ol>
        {block.ol.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    );
  }

  if (block.contact) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {block.contact.map((row) => (
          <div
            key={row.k}
            className="rounded-xl border border-slate-800 bg-slate-800/50 px-4 py-3"
          >
            <p className="text-xs text-slate-400">{row.k}</p>
            {row.v ? (
              row.href ? (
                <a
                  href={row.href}
                  className="font-medium text-white transition-colors hover:text-indigo-400"
                >
                  {row.v}
                </a>
              ) : (
                <p className="font-medium text-white">{row.v}</p>
              )
            ) : (
              <p className="font-medium italic text-amber-400/90">{row.placeholder}</p>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (block.signoff) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-indigo-500/10 to-violet-500/10 px-6 py-5">
        <p className="font-display text-lg font-bold text-white">{block.signoff.company}</p>
        <p className="text-sm text-slate-400">{block.signoff.location}</p>
      </div>
    );
  }

  return null;
}

export default function Terms() {
  useSeo({
    title: "Terms & Conditions",
    description:
      "The Terms and Conditions governing access to and use of EazeeBooks, the AI invoice and bookkeeping platform operated by Freelanzo LLC.",
    path: "/terms",
  });

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <Navbar />

      <section className="mx-auto max-w-7xl px-6 pb-8 pt-40 sm:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-400">
          Legal
        </p>

        <h1 className="mt-4 text-4xl font-bold font-display tracking-tight sm:text-5xl">
          Terms &amp; Conditions
        </h1>

        <p className="mt-5 max-w-2xl text-lg text-slate-400">
          These Terms govern your access to and use of the EazeeBooks website,
          web application, and related services, operated by Freelanzo LLC,
          Dubai, United Arab Emirates.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-medium text-amber-400">
            Draft — pending legal review
          </span>
          <span>
            Effective date:{" "}
            {TERMS_META.effectiveDate || (
              <span className="italic text-amber-400/90">to be announced</span>
            )}
          </span>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24 sm:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">

          <nav className="hidden lg:block">
            <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                On this page
              </p>

              <ol className="space-y-0.5 text-sm">
                {TERMS_SECTIONS.map((section, index) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="flex gap-2 rounded-lg px-2 py-1.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                    >
                      <span className="font-mono text-xs text-slate-500">
                        {index + 1}.
                      </span>
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          <div className="min-w-0 divide-y divide-slate-800 rounded-3xl border border-slate-800 bg-slate-900/60">
            {TERMS_SECTIONS.map((section, index) => (
              <article key={section.id} id={section.id} className="scroll-mt-28 px-6 py-8 sm:px-10">
                <h2 className="flex items-baseline gap-3 text-xl font-bold font-display tracking-tight text-white">
                  <span className="font-mono text-base font-normal text-indigo-400">
                    {index + 1}.
                  </span>
                  {section.title}
                </h2>

                <div className="mt-4 space-y-4 text-[15px] leading-7 text-slate-300 [&_li]:mb-1.5 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-white [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
                  {section.blocks.map((block, blockIndex) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <Block key={blockIndex} block={block} />
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-slate-800 bg-slate-900 p-8 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-bold font-display tracking-tight">
              Questions about these Terms?
            </h2>
            <p className="mt-2 text-slate-400">
              Reach the EazeeBooks team directly.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:sales@eazeebooks.com"
              className="flex items-center gap-2 rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Mail size={16} aria-hidden="true" />
              sales@eazeebooks.com
            </a>
            <a
              href="tel:+971562100778"
              className="flex items-center gap-2 rounded-full border border-slate-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Phone size={16} aria-hidden="true" />
              +971 56 210 0778
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
