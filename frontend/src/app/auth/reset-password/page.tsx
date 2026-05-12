"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function Spinner() {
    return (
        <div className="h-dvh flex items-center justify-center bg-[#292629]">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
    );
}

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [ready, setReady] = useState(false);
    const [done, setDone] = useState(false);

    useEffect(() => {
        const code = searchParams.get("code");
        if (code) {
            supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
                if (error) {
                    setError("Invalid or expired reset link. Please request a new one.");
                } else {
                    setReady(true);
                }
            });
        } else {
            supabase.auth.getSession().then(({ data: { session } }) => {
                if (session) {
                    setReady(true);
                } else {
                    setError("Invalid or expired reset link. Please request a new one.");
                }
            });
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }
        if (password !== confirm) {
            setError("Passwords do not match.");
            return;
        }
        setLoading(true);
        setError("");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            setDone(true);
            setTimeout(() => router.replace("/assistant"), 2000);
        }
    };

    return (
        <div className="h-dvh flex items-center justify-center bg-[#292629]">
            <div className="w-full max-w-sm px-6">
                <div className="mb-10 text-center">
                    <span className="text-white text-2xl tracking-widest uppercase">
                        <span className="font-light">CARBON</span>
                        <span className="font-bold">LEO</span>
                    </span>
                    <p className="text-white/40 text-sm mt-1 tracking-wide">
                        Set New Password
                    </p>
                </div>

                {done ? (
                    <p className="text-center text-green-400 text-sm">
                        Password updated! Redirecting…
                    </p>
                ) : !ready && !error ? (
                    <div className="flex justify-center">
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    </div>
                ) : error && !ready ? (
                    <div className="text-center space-y-4">
                        <p className="text-red-400 text-sm">{error}</p>
                        <a href="/login" className="text-white/50 text-xs underline">
                            Back to login
                        </a>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wider">
                                New Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="new-password"
                                className="w-full h-10 rounded-md bg-white/8 border border-white/12 px-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#FEEA0F]/60 focus:ring-1 focus:ring-[#FEEA0F]/30 transition-colors"
                                placeholder="••••••••"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wider">
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                required
                                autoComplete="new-password"
                                className="w-full h-10 rounded-md bg-white/8 border border-white/12 px-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#FEEA0F]/60 focus:ring-1 focus:ring-[#FEEA0F]/30 transition-colors"
                                placeholder="••••••••"
                            />
                        </div>
                        {error && <p className="text-red-400 text-sm">{error}</p>}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-10 rounded-md bg-[#FEEA0F] text-[#292629] text-sm font-semibold hover:bg-[#FEEA0F]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                        >
                            {loading ? "Updating…" : "Set New Password"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<Spinner />}>
            <ResetPasswordContent />
        </Suspense>
    );
}
