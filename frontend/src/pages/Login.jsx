import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    Eye,
    EyeOff,
    Mail,
    Lock,
    ArrowLeft,
} from "lucide-react";

import api from "../services/api";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";



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
    const navigate = useNavigate();


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
            console.log(response.data);
            if (response.data.success) {
                localStorage.setItem("token", response.data.token);

                localStorage.setItem(
                    "user",
                    JSON.stringify(response.data.user)
                );

                toast.success("Welcome back!");

                navigate("/dashboard");
            }
        } catch (error) {

            console.log(error.response?.data);

            toast.error(
                error.response?.data?.error ||
                "Invalid email or password"
            );
        }
    };
    return (
        <div className="min-h-screen bg-[#030712] text-white">

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#2563eb22,transparent_35%),radial-gradient(circle_at_bottom_right,#7c3aed22,transparent_40%)]" />

            <div className="relative flex min-h-screen">

                {/* LEFT PANEL */}

                <div className="hidden lg:flex w-1/2 items-center justify-center px-20">
                    <div>

                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 text-slate-400 hover:text-white"
                        >
                            <ArrowLeft size={18} />
                            Back to Home
                        </Link>

                        <div className="mt-12">

                            <div className="flex items-center gap-4">

                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-500 to-violet-600 font-bold text-xl">
                                    IP
                                </div>

                                <div>
                                    <h1 className="text-4xl font-bold">
                                        InvoicePilot
                                    </h1>

                                    <p className="text-slate-400">
                                        AI Finance Platform
                                    </p>
                                </div>

                            </div>

                            <h2 className="mt-16 text-5xl font-black leading-tight">
                                Welcome Back
                            </h2>

                            <p className="mt-8 max-w-lg text-lg leading-8 text-slate-400">
                                Securely access your invoices, AI analytics and
                                factorization dashboard.
                            </p>

                        </div>

                    </div>
                </div>

                {/* LOGIN FORM */}

                <div className="flex w-full lg:w-1/2 items-center justify-center px-6">

                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-10 shadow-2xl"
                    >

                        <h2 className="text-4xl font-bold">
                            Login
                        </h2>

                        <p className="mt-2 text-slate-400">
                            Sign in to continue
                        </p>

                        {/* EMAIL */}

                        <div className="mt-10">

                            <label className="mb-2 block text-sm">
                                Email Address
                            </label>

                            <div
                                className={`flex items-center rounded-xl border bg-slate-800 px-4 ${errors.email
                                        ? "border-red-500"
                                        : "border-slate-700"
                                    }`}
                            >

                                <Mail
                                    size={20}
                                    className="text-slate-400"
                                />

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

                        <div className="mt-6">

                            <label className="mb-2 block text-sm">
                                Password
                            </label>

                            <div
                                className={`flex items-center rounded-xl border bg-slate-800 px-4 ${errors.password
                                        ? "border-red-500"
                                        : "border-slate-700"
                                    }`}
                            >

                                <Lock
                                    size={20}
                                    className="text-slate-400"
                                />

                                <input
                                    {...register("password")}
                                    type={
                                        showPassword
                                            ? "text"
                                            : "password"
                                    }
                                    placeholder="••••••••"
                                    className="w-full bg-transparent px-4 py-4 outline-none"
                                />

                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPassword(!showPassword)
                                    }
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

                        <div className="mt-6 flex items-center justify-between">

                            <label className="flex items-center gap-2 text-sm text-slate-400">

                                <input type="checkbox" />

                                Remember Me

                            </label>

                            <button
                                type="button"
                                className="text-sm text-blue-500"
                            >
                                Forgot Password?
                            </button>

                        </div>

                        <button
                            disabled={isSubmitting}
                            className="mt-8 w-full rounded-xl bg-blue-600 py-4 font-semibold transition hover:bg-blue-500 disabled:opacity-60"
                        >
                            {isSubmitting
                                ? "Signing In..."
                                : "Sign In"}
                        </button>

                        <p className="mt-8 text-center text-slate-400">

                            Don't have an account?

                            <Link
                                to="/register"
                                className="ml-2 text-blue-500"
                            >
                                Create Account
                            </Link>

                        </p>

                    </form>

                </div>

            </div>

        </div>
    );
}