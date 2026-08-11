import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";

import api from "../../services/api";
import toast from "react-hot-toast";

const resetPasswordSchema = z
    .object({
        password: z
            .string()
            .min(8, "Minimum 8 characters")
            .regex(/[A-Z]/, "Must contain uppercase letter")
            .regex(/[a-z]/, "Must contain lowercase letter")
            .regex(/[0-9]/, "Must contain number"),

        confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    });

export default function ResetPassword() {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get("token");

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: { password: "", confirmPassword: "" },
    });

    const onSubmit = async (data) => {
        try {
            await api.post("/auth/reset-password", {
                token,
                password: data.password,
            });

            toast.success("Password reset successfully. You can now log in.");
            navigate("/login");
        } catch (error) {
            toast.error(
                error.response?.data?.error ||
                "This reset link is invalid or has expired."
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

                    {!token ? (
                        <div className="mt-8 text-center">

                            <h2 className="text-2xl font-bold font-display tracking-tight">
                                Invalid reset link
                            </h2>

                            <p className="mt-3 text-slate-400">
                                This password reset link is missing or malformed.
                                Please request a new one.
                            </p>

                            <Link
                                to="/forgot-password"
                                className="mt-6 inline-block text-indigo-400 transition-colors hover:text-indigo-300"
                            >
                                Request a new link
                            </Link>

                        </div>
                    ) : (
                        <form onSubmit={handleSubmit(onSubmit)}>

                            <h2 className="mt-8 text-3xl font-bold font-display tracking-tight">
                                Reset Password
                            </h2>

                            <p className="mt-2 text-slate-400">
                                Choose a new password for your account.
                            </p>

                            <div className="mt-8">

                                <label className="mb-2 block text-sm">
                                    New Password
                                </label>

                                <div
                                    className={`flex items-center rounded-xl border bg-slate-800 px-4 ${errors.password
                                            ? "border-red-500"
                                            : "border-slate-700"
                                        }`}
                                >

                                    <Lock size={20} className="text-slate-400" />

                                    <input
                                        {...register("password")}
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••"
                                        className="w-full bg-transparent px-4 py-4 outline-none"
                                    />

                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                        aria-pressed={showPassword}
                                        className="text-slate-400 transition-colors hover:text-white"
                                    >
                                        {showPassword ? (
                                            <EyeOff size={20} />
                                        ) : (
                                            <Eye size={20} />
                                        )}
                                    </button>

                                </div>

                                {errors.password && (
                                    <p className="mt-2 text-sm text-red-400">
                                        {errors.password.message}
                                    </p>
                                )}

                            </div>

                            <div className="mt-6">

                                <label className="mb-2 block text-sm">
                                    Confirm New Password
                                </label>

                                <div
                                    className={`flex items-center rounded-xl border bg-slate-800 px-4 ${errors.confirmPassword
                                            ? "border-red-500"
                                            : "border-slate-700"
                                        }`}
                                >

                                    <Lock size={20} className="text-slate-400" />

                                    <input
                                        {...register("confirmPassword")}
                                        type={showConfirm ? "text" : "password"}
                                        placeholder="••••••••"
                                        className="w-full bg-transparent px-4 py-4 outline-none"
                                    />

                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm(!showConfirm)}
                                        aria-label={showConfirm ? "Hide password" : "Show password"}
                                        aria-pressed={showConfirm}
                                        className="text-slate-400 transition-colors hover:text-white"
                                    >
                                        {showConfirm ? (
                                            <EyeOff size={20} />
                                        ) : (
                                            <Eye size={20} />
                                        )}
                                    </button>

                                </div>

                                {errors.confirmPassword && (
                                    <p className="mt-2 text-sm text-red-400">
                                        {errors.confirmPassword.message}
                                    </p>
                                )}

                            </div>

                            <button
                                disabled={isSubmitting}
                                className="mt-8 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-4 font-semibold text-white shadow-lg shadow-indigo-950/30 transition-all hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60"
                            >
                                {isSubmitting ? "Resetting..." : "Reset Password"}
                            </button>

                        </form>
                    )}

                </div>

            </div>

        </div>
    );
}
