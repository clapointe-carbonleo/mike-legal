"use client";

import { createContext, useContext, ReactNode } from "react";
import type { ApiKeyState } from "@/app/lib/mikeApi";

interface UserProfile {
    displayName: string | null;
    organisation: string | null;
    messageCreditsUsed: number;
    creditsResetDate: string;
    creditsRemaining: number;
    tier: string;
    tabularModel: string;
    titleModel: string;
    claudeApiKey: string | null;
    geminiApiKey: string | null;
    apiKeys: ApiKeyState;
    legalResearchUs: boolean;
    mfaOnLogin: boolean;
}

interface UserProfileContextType {
    profile: UserProfile;
    loading: boolean;
    updateDisplayName: (name: string) => Promise<boolean>;
    updateOrganisation: (organisation: string) => Promise<boolean>;
    updateModelPreference: (field: string, value: string) => Promise<boolean>;
    updateApiKey: (provider: string, value: string | null) => Promise<boolean>;
    updateLegalResearchUs: (value: boolean) => Promise<boolean>;
    updateMfaOnLogin: (value: boolean) => Promise<boolean>;
    reloadProfile: () => Promise<void>;
    incrementMessageCredits: () => Promise<boolean>;
}

const STATIC_PROFILE: UserProfile = {
    displayName: null,
    organisation: "Carbonleo",
    messageCreditsUsed: 0,
    creditsResetDate: "2099-01-01T00:00:00.000Z",
    creditsRemaining: 999999,
    tier: "Pro",
    tabularModel: "gemini-3-flash-preview",
    titleModel: "claude-sonnet-4-6",
    claudeApiKey: "configured",
    geminiApiKey: "configured",
    apiKeys: {
        claude: { configured: true, source: "env" },
        gemini: { configured: true, source: "env" },
        openai: { configured: false, source: null },
        openrouter: { configured: false, source: null },
        courtlistener: { configured: false, source: null },
    },
    legalResearchUs: true,
    mfaOnLogin: false,
};

const UserProfileContext = createContext<UserProfileContextType>({
    profile: STATIC_PROFILE,
    loading: false,
    updateDisplayName: async () => true,
    updateOrganisation: async () => true,
    updateModelPreference: async () => true,
    updateApiKey: async () => true,
    updateLegalResearchUs: async () => true,
    updateMfaOnLogin: async () => true,
    reloadProfile: async () => {},
    incrementMessageCredits: async () => true,
});

export function UserProfileProvider({ children }: { children: ReactNode }) {
    return (
        <UserProfileContext.Provider value={{
            profile: STATIC_PROFILE,
            loading: false,
            updateDisplayName: async () => true,
            updateOrganisation: async () => true,
            updateModelPreference: async () => true,
            updateApiKey: async () => true,
            updateLegalResearchUs: async () => true,
            updateMfaOnLogin: async () => true,
            reloadProfile: async () => {},
            incrementMessageCredits: async () => true,
        }}>
            {children}
        </UserProfileContext.Provider>
    );
}

export function useUserProfile() {
    return useContext(UserProfileContext);
}
