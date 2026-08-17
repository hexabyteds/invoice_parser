import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Loader2, Mail, MessageSquare, Phone, MessageCircle, User } from "lucide-react";
import toast from "react-hot-toast";

import api from "../../services/api";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import { useSeo } from "../../hooks/useSeo";

const PHONE_DISPLAY = "+971 56 210 0778";
const PHONE_TEL = "tel:+971562100778";
const WHATSAPP_URL = "https://wa.me/971562100778";
const CONTACT_EMAIL = "sales@eazeebooks.com";

const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter your name"),

  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),

  message: z
    .string()
    .trim()
    .min(10, "Please enter a message (at least 10 characters)")
    .max(5000, "Message is too long"),

  // Honeypot — real visitors never see or fill this in. Left blank by
  // default and validated server-side too; this field only exists to
  // give bots something to fill in that quietly drops the submission.
  company_website: z.string().optional(),
});

export default function Contact() {
  useSeo({
    title: "Contact Us",
    description:
      "Get in touch with the EazeeBooks team — send a message or reach us directly by phone, WhatsApp, or email.",
    path: "/contact",
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      message: "",
      company_website: "",
    },
  });

  const onSubmit = async (data) => {
    try {
      const response = await api.post("/contact", data);

      toast.success(
        response.data.message || "Thanks for reaching out — we'll get back to you soon."
      );

      reset();
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
        "Something went wrong. Please try again."
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <Navbar />

      <section className="mx-auto max-w-7xl px-6 pb-24 pt-40 sm:px-8">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-400">
            Contact
          </p>

          <h1 className="mt-4 text-4xl font-bold font-display tracking-tight sm:text-5xl">
            Get in touch
          </h1>

          <p className="mt-5 text-lg text-slate-400">
            Questions about EazeeBooks, pricing, or your account? Send us a
            message or reach out directly.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-8 lg:grid-cols-5">

          {/* Form */}

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 lg:col-span-3">
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">

              {/* Honeypot — hidden from sighted and screen-reader users, but
                  present in the DOM/tab order avoidance so simple bots that
                  auto-fill every input still trip it. */}
              <div
                className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
                aria-hidden="true"
              >
                <label htmlFor="company_website">Leave this field empty</label>
                <input
                  id="company_website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  {...register("company_website")}
                />
              </div>

              <div>
                <label htmlFor="name" className="mb-2 block text-sm text-slate-300">
                  Name
                </label>

                <div
                  className={`flex items-center rounded-xl border bg-slate-800 px-4 transition-colors ${
                    errors.name
                      ? "border-red-500"
                      : "border-slate-700 focus-within:border-indigo-500"
                  }`}
                >
                  <User size={20} className="shrink-0 text-slate-400" />

                  <input
                    id="name"
                    {...register("name")}
                    placeholder="Jane Doe"
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? "name-error" : undefined}
                    className="w-full bg-transparent px-4 py-4 outline-none"
                  />
                </div>

                {errors.name && (
                  <p id="name-error" className="mt-2 text-sm text-red-400">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="mb-2 block text-sm text-slate-300">
                  Email Address
                </label>

                <div
                  className={`flex items-center rounded-xl border bg-slate-800 px-4 transition-colors ${
                    errors.email
                      ? "border-red-500"
                      : "border-slate-700 focus-within:border-indigo-500"
                  }`}
                >
                  <Mail size={20} className="shrink-0 text-slate-400" />

                  <input
                    id="email"
                    type="email"
                    {...register("email")}
                    placeholder="jane@example.com"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    className="w-full bg-transparent px-4 py-4 outline-none"
                  />
                </div>

                {errors.email && (
                  <p id="email-error" className="mt-2 text-sm text-red-400">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="message" className="mb-2 block text-sm text-slate-300">
                  Message
                </label>

                <div
                  className={`flex rounded-xl border bg-slate-800 px-4 transition-colors ${
                    errors.message
                      ? "border-red-500"
                      : "border-slate-700 focus-within:border-indigo-500"
                  }`}
                >
                  <MessageSquare size={20} className="mt-4 shrink-0 text-slate-400" />

                  <textarea
                    id="message"
                    {...register("message")}
                    placeholder="Tell us what you need help with..."
                    rows={5}
                    aria-invalid={Boolean(errors.message)}
                    aria-describedby={errors.message ? "message-error" : undefined}
                    className="w-full resize-none bg-transparent px-4 py-4 outline-none"
                  />
                </div>

                {errors.message && (
                  <p id="message-error" className="mt-2 text-sm text-red-400">
                    {errors.message.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-4 font-semibold text-white shadow-lg shadow-indigo-950/30 transition-all hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                {isSubmitting ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>

          {/* Direct contact options */}

          <div className="flex flex-col gap-4 lg:col-span-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
              <h2 className="text-lg font-semibold text-white">
                Reach us directly
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Prefer not to fill out a form? Contact us any of these ways.
              </p>

              <div className="mt-6 space-y-4">
                <a
                  href={PHONE_TEL}
                  className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-800/50 p-4 transition-colors hover:border-slate-700 hover:bg-slate-800"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-indigo-400">
                    <Phone size={18} aria-hidden="true" />
                  </span>

                  <span>
                    <span className="block text-xs text-slate-400">Phone</span>
                    <span className="block font-medium text-white">{PHONE_DISPLAY}</span>
                  </span>
                </a>

                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-800/50 p-4 transition-colors hover:border-slate-700 hover:bg-slate-800"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-green-400">
                    <MessageCircle size={18} aria-hidden="true" />
                  </span>

                  <span>
                    <span className="block text-xs text-slate-400">WhatsApp</span>
                    <span className="block font-medium text-white">{PHONE_DISPLAY}</span>
                  </span>
                </a>

                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-800/50 p-4 transition-colors hover:border-slate-700 hover:bg-slate-800"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-indigo-400">
                    <Mail size={18} aria-hidden="true" />
                  </span>

                  <span>
                    <span className="block text-xs text-slate-400">Email</span>
                    <span className="block font-medium text-white">{CONTACT_EMAIL}</span>
                  </span>
                </a>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
              <h2 className="text-lg font-semibold text-white">
                Response time
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                We typically reply within one business day.
              </p>
            </div>
          </div>

        </div>
      </section>

      <Footer />
    </div>
  );
}
