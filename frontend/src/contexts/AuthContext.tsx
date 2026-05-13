"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";

interface User {
    id: string;
    email: string;
    name: string;
}

interface AuthContextType {
    user: User;
    isAuthenticated: boolean;
    authLoading: boolean;
    signOut: () => Promise<void>;
}

const FALLBACK_USER: User = { id: "", email: "", name: "" };

const AuthContext = createContext<AuthContextType>({
    user: FALLBACK_USER,
    isAuthenticated: false,
    authLoading: true,
    signOut: async () => {},
});

function extractUser(supabaseUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }): User {
    const meta = supabaseUser.user_metadata ?? {};
    const fullName = (meta.full_name ?? meta.name ?? meta.display_name ?? "") as string;
    const givenName = (meta.given_name ?? "") as string;
    const name = fullName.trim() || givenName.trim() || "";
    return {
        id: supabaseUser.id,
        email: supabaseUser.email ?? "",
        name,
    };
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User>(FALLBACK_USER);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUser(extractUser(session.user));
                setIsAuthenticated(true);
            }
            setAuthLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                setUser(extractUser(session.user));
                setIsAuthenticated(true);
            } else {
                setUser(FALLBACK_USER);
                setIsAuthenticated(false);
            }
            setAuthLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated, authLoading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
