import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";

import api from "../../services/api";
import toast from "react-hot-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getPostLoginPath } from "../../utils/roles";
import AuthLayout from "../../layouts/AuthLayout";

const loginSchema = z.object({
    email: z
        .string()
        .min(1, "Email is required")
        .email("Please enter a valid email address"),

    password: z
        .string()
        .min(1, "Password is required")
        .min(8, "Password must be at least 8 characters"),
});

export default function Login() {
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const navigate = useNavigate();
    const { login } = useAuth();
    const [searchParams] = useSearchParams();
    // Only ever an in-app path (e.g. `/invite/:token`, from AcceptInvite.jsx
    // routing an existing account through login before showing the
    // acceptance screen) — never an absolute/external URL, so this can't
    // be turned into an open redirect.
    const next = searchParams.get("next");
    const isSafeNext = next && next.startsWith("/") && !next.startsWith("//");

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    const onSubmit = async (data) => {
        try {
            const response = await api.post("/auth/login", {
                email: data.email,
                password: data.password,
            });

            if (response.data.success) {
                const { user, token } = response.data;

                login(user, token, rememberMe);

                toast.success("Welcome back!");

                navigate(isSafeNext ? next : getPostLoginPath(user));
            }
        } catch (error) {
            toast.error(
                error.response?.data?.error ||
                "Invalid email or password"
            );
        }
    };

    return (
        <AuthLayout
            variant="minimal"
            title="Welcome Back"
            subtitle="Sign in to continue to your dashboard."
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                {/* EMAIL */}

                <div>
                    <label className="mb-2 block text-sm text-slate-300">
                        Email Address
                    </label>

                    <div
                        className={`flex items-center rounded-xl border bg-slate-800 px-4 transition-colors ${
                            errors.email
                                ? "border-red-500"
                                : "border-slate-700 focus-within:border-indigo-500"
                        }`}
                    >
                        <Mail size={20} className="text-slate-400 shrink-0" />

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

                {/* PASSWORD */}

                <div>
                    <label className="mb-2 block text-sm text-slate-300">
                        Password
                    </label>

                    <div
                        className={`flex items-center rounded-xl border bg-slate-800 px-4 transition-colors ${
                            errors.password
                                ? "border-red-500"
                                : "border-slate-700 focus-within:border-indigo-500"
                        }`}
                    >
                        <Lock size={20} className="text-slate-400 shrink-0" />

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
                            className="-m-2 shrink-0 p-2 text-slate-400 transition-colors hover:text-white"
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

                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-slate-400">
                        <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                        />
                        Remember Me
                    </label>

                    <Link
                        to="/forgot-password"
                        className="text-sm text-indigo-400 transition-colors hover:text-indigo-300"
                    >
                        Forgot Password?
                    </Link>
                </div>

                <button
                    disabled={isSubmitting}
                    className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-4 font-semibold text-white shadow-lg shadow-indigo-950/30 transition-all hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60"
                >
                    {isSubmitting ? "Signing In..." : "Sign In"}
                </button>

                <p className="text-center text-slate-400">
                    Don't have an account?{" "}
                    <Link
                        to="/register"
                        className="font-medium text-indigo-400 transition-colors hover:text-indigo-300"
                    >
                        Create Account
                    </Link>
                </p>

            </form>
        </AuthLayout>
    );
}
