"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
    const router = useRouter();

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_IN" && session) {
                router.replace("/assistant");
            } else if (event === "SIGNED_OUT" || (event !== "INITIAL_SESSION" && !session)) {
                router.replace("/login?error=auth_failed");
            }
        });

        // Fallback: if session already exists (code already exchanged), redirect immediately
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) router.replace("/assistant");
        });

        return () => subscription.unsubscribe();
    }, [router]);

    return (
        <div className="h-dvh flex items-center justify-center bg-background">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
        </div>
    );
}
