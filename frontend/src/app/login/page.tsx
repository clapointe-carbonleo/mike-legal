"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAzureLogin = async () => {
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "azure",
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        if (error) {
            setError(error.message);
            setLoading(false);
        }
    };

    return (
        <div className="h-dvh flex items-center justify-center bg-background">
            <div className="w-full max-w-sm flex flex-col items-center gap-8 px-6">
                <div className="flex flex-col items-center gap-2 text-center">
                    <h1 className="font-serif text-3xl font-medium text-foreground">Mike</h1>
                    <p className="text-sm text-muted-foreground">AI Legal Platform</p>
                </div>

                <div className="w-full flex flex-col gap-3">
                    <button
                        onClick={() => void handleAzureLogin()}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 21 21">
                            <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                            <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                            <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                        </svg>
                        {loading ? "Redirection…" : "Se connecter avec Microsoft"}
                    </button>

                    {error && (
                        <p className="text-center text-sm text-destructive">{error}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
