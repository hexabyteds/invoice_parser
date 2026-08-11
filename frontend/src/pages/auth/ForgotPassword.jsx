import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

import api from "../../services/api";
import toast from "react-hot-toast";

const forgotPasswordSchema = z.object({
    email: z
        .string()
        .min(1, "Email is required")
        .email("Please enter a valid email address"),
});

export default function ForgotPassword() {
    const [sent, setSent] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: zodResolver(forgotPasswordSchema),
        defaultValues: { email: "" },
    });

    const onSubmit = async (data) => {
        try {
            await api.post("/auth/forgot-password", { email: data.email });

            // Always show the same success state, whether or not the email
            // is registered — the backend response is identical either way.

            
            setSent(true);
        } catch (error) {
            toast.error(
                error.response?.data?.error ||
                "Something went wrong. Please try again."
            );
        }
    };

    return (
        <div className="min-h-screen bg-[#030712] text-white">

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#2563eb22,transparent_35%),radial-gradient(circle_at_bottom_right,#7c3aed22,transparent_40%)]" />

            <div className="relative flex min-h-screen items-center justify-center px-6">

                <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-10 shadow-2xl">

                    <Link
                        to="/login"
                        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
                    >
                        <ArrowLeft size={16} />
                        Back to Login
                    </Link>

                    {sent ? (
                        <div className="mt-8 text-center">

                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10 text-green-400">
                                <CheckCircle size={28} />
                            </div>

                            <h2 className="mt-6 text-2xl font-bold font-display tracking-tight">
                                Check your email
                            </h2>

                            <p className="mt-3 text-slate-400">
                                If an account exists for that email, we've sent
                                a link to reset your password. The link expires
                                in 1 hour.
                            </p>

                        </div>
                    ) : (
                        <form onSubmit={handleSubmit(onSubmit)}>

                            <h2 className="mt-8 text-3xl font-bold font-display tracking-tight">
                                Forgot Password?
                            </h2>

                            <p className="mt-2 text-slate-400">
                                Enter your email and we'll send you a link to
                                reset your password.
                            </p>

                            <div className="mt-8">

                                <label className="mb-2 block text-sm">
                                    Email Address
                                </label>

                                <div
                                    className={`flex items-center rounded-xl border bg-slate-800 px-4 ${errors.email
                                            ? "border-red-500"
                                            : "border-slate-700"
                                        }`}
                                >

                                    <Mail size={20} className="text-slate-400" />

                                    <input
                                        {...register("email")}
                                        type="email"
                                        placeholder="john@example.com"
                                        className="w-full bg-transparent px-4 py-4 outline-none"
                                    />

                                </div>

                                {errors.email && (
                                    <p className="mt-2 text-sm text-red-400">
                                        {errors.email.message}
                                    </p>
                                )}

                            </div>

                            <button
                                disabled={isSubmitting}
                                className="mt-8 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-4 font-semibold text-white shadow-lg shadow-indigo-950/30 transition-all hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60"
                            >
                                {isSubmitting ? "Sending..." : "Send Reset Link"}
                            </button>

                        </form>
                    )}

                </div>

            </div>

        </div>
    );
}
