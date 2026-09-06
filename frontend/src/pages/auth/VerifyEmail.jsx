import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, ArrowLeft } from "lucide-react";

import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";

export default function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const { user, updateUser } = useAuth();
    const [status, setStatus] = useState(token ? "verifying" : "missing");

    useEffect(() => {
        if (!token) return;

        api
            .get(`/auth/verify-email/${token}`)
            .then(() => {
                setStatus("verified");
                // No page reload needed for an already-logged-in user (e.g.
                // opened this link in the same session) — just reflect the
                // verified state immediately.
                if (user) updateUser({ ...user, email_verified: true });
            })
            .catch(() => setStatus("invalid"));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    return (
        <div className="min-h-screen bg-[#030712] text-white">

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#2563eb22,transparent_35%),radial-gradient(circle_at_bottom_right,#7c3aed22,transparent_40%)]" />

            <div className="relative flex min-h-screen items-center justify-center px-6">

                <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-10 text-center shadow-2xl">

                    <Link
                        to="/login"
                        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
                    >
                        <ArrowLeft size={16} />
                        Back to Login
                    </Link>

                    {status === "verifying" && (
                        <div className="mt-10 flex flex-col items-center gap-3">
                            <Loader2 className="animate-spin text-indigo-400" size={32} />
                            <p className="text-slate-400">Verifying your email…</p>
                        </div>
                    )}

                    {status === "verified" && (
                        <div className="mt-10 flex flex-col items-center gap-3">
                            <CheckCircle2 className="text-green-400" size={40} />
                            <h2 className="text-2xl font-bold font-display tracking-tight">
                                Email verified
                            </h2>
                            <p className="text-slate-400">
                                Your email address has been confirmed.
                            </p>
                            <Link
                                to="/dashboard"
                                className="mt-4 inline-block rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 font-semibold transition hover:opacity-90"
                            >
                                Go to Dashboard
                            </Link>
                        </div>
                    )}

                    {(status === "invalid" || status === "missing") && (
                        <div className="mt-10 flex flex-col items-center gap-3">
                            <XCircle className="text-red-400" size={40} />
                            <h2 className="text-2xl font-bold font-display tracking-tight">
                                Verification link invalid
                            </h2>
                            <p className="text-slate-400">
                                This link is missing, invalid, or has expired. You can request
                                a new one from your account settings.
                            </p>
                        </div>
                    )}

                </div>

            </div>

        </div>
    );
}
