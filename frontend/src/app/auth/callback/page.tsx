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

function CallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const code = searchParams.get("code");
        const errorParam = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        if (errorParam) {
            setError(errorDescription ?? errorParam);
            return;
        }

        if (code) {
            supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
                if (error) {
                    setError(error.message);
                } else {
                    router.replace("/assistant");
                }
            });
        } else {
            supabase.auth.getSession().then(({ data: { session } }) => {
                router.replace(session ? "/assistant" : "/login");
            });
        }
    }, [searchParams, router]);

    if (error) {
        return (
            <div className="h-dvh flex items-center justify-center bg-[#292629]">
                <div className="text-center space-y-4 px-6">
                    <p className="text-red-400 text-sm">{error}</p>
                    <a href="/login" className="text-white/50 text-xs underline">
                        Back to login
                    </a>
                </div>
            </div>
        );
    }

    return <Spinner />;
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={<Spinner />}>
            <CallbackContent />
        </Suspense>
    );
}
