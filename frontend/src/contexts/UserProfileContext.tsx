"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
    getUserProfile,
    saveApiKey,
    updateUserMfaOnLogin,
    updateUserProfile,
    type ApiKeyProvider,
    type ApiKeyState,
    type ApiKeyStatus,
    type UpdateUserProfilePayload,
    type UserProfile as ApiUserProfile,
} from "@/app/lib/mikeApi";

const API_KEY_PROVIDERS: ApiKeyProvider[] = [
    "claude",
    "gemini",
    "openai",
    "openrouter",
    "courtlistener",
];

type ModelPreferenceField = "mainModel" | "titleModel" | "tabularModel";

interface UserProfile {
    displayName: string | null;
    organisation: string | null;
    messageCreditsUsed: number;
    creditsResetDate: string;
    creditsRemaining: number;
    tier: string;
    mainModel: string;
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
    updateModelPreference: (
        field: ModelPreferenceField,
        value: string,
    ) => Promise<boolean>;
    updateApiKey: (provider: string, value: string | null) => Promise<boolean>;
    updateLegalResearchUs: (value: boolean) => Promise<boolean>;
    updateMfaOnLogin: (value: boolean) => Promise<boolean>;
    reloadProfile: () => Promise<void>;
    incrementMessageCredits: () => Promise<boolean>;
}

function apiKeyStatusToState(apiKeyStatus: ApiKeyStatus): ApiKeyState {
    return API_KEY_PROVIDERS.reduce((acc, provider) => {
        const configured = Boolean(apiKeyStatus[provider]);
        acc[provider] = {
            configured,
            source:
                apiKeyStatus.sources?.[provider] ??
                (configured ? "user" : null),
        };
        return acc;
    }, {} as ApiKeyState);
}

function profileFromApi(apiProfile: ApiUserProfile): UserProfile {
    const apiKeys = apiKeyStatusToState(apiProfile.apiKeyStatus);
    return {
        displayName: apiProfile.displayName,
        organisation: apiProfile.organisation,
        messageCreditsUsed: apiProfile.messageCreditsUsed,
        creditsResetDate: apiProfile.creditsResetDate,
        creditsRemaining: apiProfile.creditsRemaining,
        tier: apiProfile.tier,
        mainModel: apiProfile.mainModel,
        tabularModel: apiProfile.tabularModel,
        titleModel: apiProfile.titleModel,
        claudeApiKey: apiKeys.claude.configured ? "configured" : null,
        geminiApiKey: apiKeys.gemini.configured ? "configured" : null,
        apiKeys,
        legalResearchUs: apiProfile.legalResearchUs,
        mfaOnLogin: apiProfile.mfaOnLogin,
    };
}

const EMPTY_API_KEY_STATUS: ApiKeyStatus = {
    claude: false,
    gemini: false,
    openai: false,
    openrouter: false,
    courtlistener: false,
};

const DEFAULT_PROFILE: UserProfile = {
    displayName: null,
    organisation: null,
    messageCreditsUsed: 0,
    creditsResetDate: "2099-01-01T00:00:00.000Z",
    creditsRemaining: 999999,
    tier: "Free",
    mainModel: "claude-sonnet-4-6",
    tabularModel: "gemini-3-flash-preview",
    titleModel: "gemini-3.1-flash-lite-preview",
    claudeApiKey: null,
    geminiApiKey: null,
    apiKeys: apiKeyStatusToState(EMPTY_API_KEY_STATUS),
    legalResearchUs: true,
    mfaOnLogin: false,
};

const UserProfileContext = createContext<UserProfileContextType>({
    profile: DEFAULT_PROFILE,
    loading: true,
    updateDisplayName: async () => false,
    updateOrganisation: async () => false,
    updateModelPreference: async () => false,
    updateApiKey: async () => false,
    updateLegalResearchUs: async () => false,
    updateMfaOnLogin: async () => false,
    reloadProfile: async () => {},
    incrementMessageCredits: async () => false,
});

function normalizeProvider(provider: string): ApiKeyProvider | null {
    return API_KEY_PROVIDERS.includes(provider as ApiKeyProvider)
        ? (provider as ApiKeyProvider)
        : null;
}

export function UserProfileProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated, authLoading } = useAuth();
    const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
    const [loading, setLoading] = useState(true);
    const reloadRequestVersionRef = useRef(0);
    const profileMutationVersionRef = useRef(0);
    const mutationInFlightCountRef = useRef(0);
    const modelPreferenceRequestRef = useRef<
        Record<ModelPreferenceField, number>
    >({
        mainModel: 0,
        titleModel: 0,
        tabularModel: 0,
    });

    const reloadProfile = useCallback(async () => {
        if (authLoading) {
            setLoading(true);
            return;
        }

        const requestVersion = reloadRequestVersionRef.current + 1;
        reloadRequestVersionRef.current = requestVersion;
        const mutationVersionAtStart = profileMutationVersionRef.current;
        const mutationInFlightAtStart =
            mutationInFlightCountRef.current > 0;

        if (!isAuthenticated) {
            setProfile(DEFAULT_PROFILE);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const apiProfile = await getUserProfile();
            if (
                reloadRequestVersionRef.current === requestVersion &&
                profileMutationVersionRef.current ===
                    mutationVersionAtStart &&
                !mutationInFlightAtStart &&
                mutationInFlightCountRef.current === 0
            ) {
                setProfile(profileFromApi(apiProfile));
            }
        } catch (error) {
            console.error("[profile] failed to load user profile", error);
        } finally {
            if (
                reloadRequestVersionRef.current === requestVersion &&
                mutationInFlightCountRef.current === 0
            ) {
                setLoading(false);
            }
        }
    }, [authLoading, isAuthenticated]);

    useEffect(() => {
        void reloadProfile();
    }, [reloadProfile]);

    const applyProfileUpdate = useCallback(
        async (payload: UpdateUserProfilePayload) => {
            const mutationVersion = profileMutationVersionRef.current + 1;
            profileMutationVersionRef.current = mutationVersion;
            mutationInFlightCountRef.current += 1;
            try {
                const apiProfile = await updateUserProfile(payload);
                if (profileMutationVersionRef.current === mutationVersion) {
                    setProfile(profileFromApi(apiProfile));
                    setLoading(false);
                }
                return true;
            } catch (error) {
                console.error("[profile] failed to update user profile", error);
                if (profileMutationVersionRef.current === mutationVersion) {
                    setLoading(false);
                }
                return false;
            } finally {
                mutationInFlightCountRef.current = Math.max(
                    mutationInFlightCountRef.current - 1,
                    0,
                );
            }
        },
        [],
    );

    const updateModelPreference = useCallback(
        async (field: ModelPreferenceField, model: string) => {
            const mutationVersion = profileMutationVersionRef.current + 1;
            profileMutationVersionRef.current = mutationVersion;
            mutationInFlightCountRef.current += 1;
            const requestId = modelPreferenceRequestRef.current[field] + 1;
            modelPreferenceRequestRef.current[field] = requestId;
            const payload: UpdateUserProfilePayload =
                field === "mainModel"
                    ? { mainModel: model }
                    : field === "titleModel"
                      ? { titleModel: model }
                      : { tabularModel: model };

            try {
                const apiProfile = await updateUserProfile(payload);
                if (
                    profileMutationVersionRef.current === mutationVersion &&
                    modelPreferenceRequestRef.current[field] === requestId
                ) {
                    setProfile(profileFromApi(apiProfile));
                    setLoading(false);
                }
                return true;
            } catch (error) {
                console.error("[profile] failed to update user profile", error);
                if (profileMutationVersionRef.current === mutationVersion) {
                    setLoading(false);
                }
                return false;
            } finally {
                mutationInFlightCountRef.current = Math.max(
                    mutationInFlightCountRef.current - 1,
                    0,
                );
            }
        },
        [],
    );

    const value = useMemo<UserProfileContextType>(
        () => ({
            profile,
            loading,
            updateDisplayName: (name) =>
                applyProfileUpdate({ displayName: name }),
            updateOrganisation: (organisation) =>
                applyProfileUpdate({ organisation }),
            updateModelPreference,
            updateApiKey: async (provider, apiKey) => {
                const normalized = normalizeProvider(provider);
                if (!normalized) return false;
                const mutationVersion = profileMutationVersionRef.current + 1;
                profileMutationVersionRef.current = mutationVersion;
                mutationInFlightCountRef.current += 1;
                try {
                    const apiKeyStatus = await saveApiKey(normalized, apiKey);
                    const apiKeys = apiKeyStatusToState(apiKeyStatus);
                    if (
                        profileMutationVersionRef.current === mutationVersion
                    ) {
                        setProfile((current) => ({
                            ...current,
                            claudeApiKey: apiKeys.claude.configured
                                ? "configured"
                                : null,
                            geminiApiKey: apiKeys.gemini.configured
                                ? "configured"
                                : null,
                            apiKeys,
                        }));
                        setLoading(false);
                    }
                    return true;
                } catch (error) {
                    console.error("[profile] failed to update API key", error);
                    if (
                        profileMutationVersionRef.current === mutationVersion
                    ) {
                        setLoading(false);
                    }
                    return false;
                } finally {
                    mutationInFlightCountRef.current = Math.max(
                        mutationInFlightCountRef.current - 1,
                        0,
                    );
                }
            },
            updateLegalResearchUs: (legalResearchUs) =>
                applyProfileUpdate({ legalResearchUs }),
            updateMfaOnLogin: async (enabled) => {
                const mutationVersion = profileMutationVersionRef.current + 1;
                profileMutationVersionRef.current = mutationVersion;
                mutationInFlightCountRef.current += 1;
                try {
                    const apiProfile = await updateUserMfaOnLogin(enabled);
                    if (
                        profileMutationVersionRef.current === mutationVersion
                    ) {
                        setProfile(profileFromApi(apiProfile));
                        setLoading(false);
                    }
                    return true;
                } catch (error) {
                    console.error(
                        "[profile] failed to update MFA login preference",
                        error,
                    );
                    if (
                        profileMutationVersionRef.current === mutationVersion
                    ) {
                        setLoading(false);
                    }
                    return false;
                } finally {
                    mutationInFlightCountRef.current = Math.max(
                        mutationInFlightCountRef.current - 1,
                        0,
                    );
                }
            },
            reloadProfile,
            incrementMessageCredits: async () => {
                setProfile((current) => ({
                    ...current,
                    messageCreditsUsed: current.messageCreditsUsed + 1,
                    creditsRemaining: Math.max(current.creditsRemaining - 1, 0),
                }));
                return true;
            },
        }),
        [
            applyProfileUpdate,
            loading,
            profile,
            reloadProfile,
            updateModelPreference,
        ],
    );

    return (
        <UserProfileContext.Provider value={value}>
            {children}
        </UserProfileContext.Provider>
    );
}

export function useUserProfile() {
    return useContext(UserProfileContext);
}
