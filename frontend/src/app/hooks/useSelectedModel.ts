"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    ALLOWED_MODEL_IDS,
    DEFAULT_MODEL_ID,
} from "../components/assistant/ModelToggle";
import { useUserProfile } from "@/contexts/UserProfileContext";

const STORAGE_KEY = "mike.selectedModel";

function normalizeModel(id: string | null | undefined): string {
    if (id && ALLOWED_MODEL_IDS.has(id)) return id;
    return DEFAULT_MODEL_ID;
}

function writeStored(id: string) {
    if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, id);
    }
}

function readStored(): string {
    if (typeof window === "undefined") return DEFAULT_MODEL_ID;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return normalizeModel(raw);
}

export function useSelectedModel(): [string, (id: string) => void] {
    const { profile, loading, updateModelPreference } = useUserProfile();
    const [cacheModel, setCacheModel] = useState<string>(() => readStored());
    const [pendingModel, setPendingModel] = useState<{
        id: string;
        previous: string;
    } | null>(null);
    const cacheSyncVersionRef = useRef(0);
    const mountedRef = useRef(false);
    const saveRequestRef = useRef(0);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (loading) return;
        const next = normalizeModel(profile.mainModel);
        const syncVersion = cacheSyncVersionRef.current + 1;
        cacheSyncVersionRef.current = syncVersion;
        writeStored(next);
        setTimeout(() => {
            if (
                !mountedRef.current ||
                cacheSyncVersionRef.current !== syncVersion
            ) {
                return;
            }
            setCacheModel(next);
        }, 0);
    }, [loading, profile.mainModel]);

    const profileModel = normalizeModel(profile.mainModel);
    const model = pendingModel?.id ?? (loading ? cacheModel : profileModel);

    const setModel = useCallback(
        (id: string) => {
            const next = normalizeModel(id);
            const previous = loading ? cacheModel : profileModel;
            const requestId = saveRequestRef.current + 1;
            saveRequestRef.current = requestId;
            setPendingModel({ id: next, previous });
            setCacheModel(next);
            writeStored(next);
            void updateModelPreference("mainModel", next).then((ok) => {
                if (saveRequestRef.current !== requestId) return;
                if (ok) {
                    setPendingModel(null);
                    setCacheModel(next);
                    return;
                }
                setPendingModel(null);
                setCacheModel(previous);
                writeStored(previous);
            });
        },
        [cacheModel, loading, profileModel, updateModelPreference],
    );

    return [model, setModel];
}
