import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import { useSeo } from "../../hooks/useSeo";

export default function LegalStub({ title }) {
  useSeo({
    title,
    description: `EazeeBooks ${title.toLowerCase()}.`,
    path: title === "Privacy Policy" ? "/privacy" : "/terms",
  });

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <Navbar />

      <section className="mx-auto max-w-3xl px-6 pb-24 pt-40 sm:px-8">
        <h1 className="text-4xl font-bold">{title}</h1>

        <p className="mt-6 text-lg text-slate-400">
          This page is being finalized. In the meantime, reach out to{" "}
          <a href="mailto:sales@eazeebooks.com" className="text-blue-400 hover:text-blue-300">
            sales@eazeebooks.com
          </a>{" "}
          with any questions about how EazeeBooks handles your data or the
          terms that apply to your account.
        </p>
      </section>

      <Footer />
    </div>
  );
}
