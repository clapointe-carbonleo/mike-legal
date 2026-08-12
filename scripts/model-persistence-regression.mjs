import fs from "node:fs";

const files = {
    backendModels: "backend/src/lib/llm/models.ts",
    backendUserRoute: "backend/src/routes/user.ts",
    frontendModelToggle: "frontend/src/app/components/assistant/ModelToggle.tsx",
    selectedModelHook: "frontend/src/app/hooks/useSelectedModel.ts",
    userProfileContext: "frontend/src/contexts/UserProfileContext.tsx",
    accountModelsPage: "frontend/src/app/(pages)/account/models/page.tsx",
};

function read(path) {
    return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function arrayForConst(source, name) {
    const match = source.match(
        new RegExp(`(?:export\\s+)?const ${name} = \\[([\\s\\S]*?)\\] as const;`),
    );
    assert(match, `Missing ${name}`);
    return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

const backendModels = read(files.backendModels);
const backendUserRoute = read(files.backendUserRoute);
const frontendModelToggle = read(files.frontendModelToggle);
const selectedModelHook = read(files.selectedModelHook);
const userProfileContext = read(files.userProfileContext);
const accountModelsPage = read(files.accountModelsPage);

const backendMainIds = [
    ...arrayForConst(backendModels, "CLAUDE_MAIN_MODELS"),
    ...arrayForConst(backendModels, "GEMINI_MAIN_MODELS"),
    ...arrayForConst(backendModels, "OPENAI_MAIN_MODELS"),
];
const backendLowIds = [
    ...arrayForConst(backendModels, "CLAUDE_LOW_MODELS"),
    ...arrayForConst(backendModels, "GEMINI_LOW_MODELS"),
    ...arrayForConst(backendModels, "OPENAI_LOW_MODELS"),
];
const frontendModelsBlock = frontendModelToggle.match(
    /export const MODELS: ModelOption\[] = \[([\s\S]*?)\];/,
)?.[1];
assert(frontendModelsBlock, "Missing frontend MODELS export");
const frontendMainIds = [
    ...frontendModelsBlock.matchAll(/id: "([^"]+)"/g),
].map((item) => item[1]);

const missingFrontend = backendMainIds.filter(
    (id) => !frontendMainIds.includes(id),
);
const missingBackend = frontendMainIds.filter(
    (id) => !backendMainIds.includes(id),
);
assert(
    missingFrontend.length === 0 && missingBackend.length === 0,
    `Model drift: ${JSON.stringify({ missingFrontend, missingBackend })}`,
);

for (const id of [
    "claude-fable-5",
    "claude-opus-4-8",
    "gemini-3.5-flash",
    "gpt-5.5",
]) {
    assert(backendMainIds.includes(id), `Missing main model ${id}`);
}
for (const id of [
    "claude-haiku-4-5",
    "gemini-3.1-flash-lite-preview",
    "gpt-5.4-lite",
]) {
    assert(backendLowIds.includes(id), `Missing expected low-tier model ${id}`);
    assert(!backendMainIds.includes(id), `Low-tier model is main-selectable: ${id}`);
    assert(
        !frontendMainIds.includes(id),
        `Low-tier model is in frontend main MODELS: ${id}`,
    );
}

assert(
    backendModels.includes("export function resolveMainModel") &&
        backendModels.includes("MAIN_MODEL_ID_SET.has(id)"),
    "resolveMainModel is not strict-main backed",
);
assert(
    backendUserRoute.includes(
        "mainModel: resolveMainModel(row.main_model, DEFAULT_MAIN_MODEL)",
    ),
    "Profile serialization must use resolveMainModel for mainModel",
);
assert(
    backendUserRoute.includes("const resolved = resolveMainModel(raw.mainModel, null)") &&
        backendUserRoute.includes("update.main_model = resolved"),
    "Profile PATCH validation must use resolveMainModel for mainModel",
);

assert(
    selectedModelHook.includes("cacheSyncVersionRef") &&
        selectedModelHook.includes("mountedRef") &&
        /if \(loading\) return;[\s\S]*writeStored\(next\);[\s\S]*setTimeout\(\(\) => \{[\s\S]*setCacheModel\(next\);[\s\S]*\}, 0\);/.test(
            selectedModelHook,
        ),
    "useSelectedModel must asynchronously sync cacheModel from backend profile",
);
assert(
    selectedModelHook.includes('updateModelPreference("mainModel", next)'),
    "useSelectedModel must persist only explicit main model selections",
);
assert(
    !userProfileContext.includes("profileRequestVersionRef") &&
        userProfileContext.includes("reloadRequestVersionRef") &&
        userProfileContext.includes("profileMutationVersionRef") &&
        userProfileContext.includes("mutationInFlightCountRef") &&
        userProfileContext.includes("mutationVersionAtStart") &&
        userProfileContext.includes("mutationInFlightAtStart") &&
        userProfileContext.includes(
            "reloadRequestVersionRef.current === requestVersion",
        ) &&
        userProfileContext.includes(
            "profileMutationVersionRef.current === mutationVersion",
        ) &&
        /profileMutationVersionRef\.current\s*===\s*mutationVersionAtStart/.test(
            userProfileContext,
        ) &&
        userProfileContext.includes(
            "mutationInFlightCountRef.current === 0",
        ),
    "UserProfileContext must independently arbitrate reload and mutation responses",
);
assert(
    /if \(ok\) \{\s*setOptimisticValues\(\(current\) => \{\s*const next = \{ \.\.\.current \};\s*delete next\[field\];\s*return next;\s*\}\);/.test(
        accountModelsPage,
    ),
    "Account models page must clear per-field optimistic value on save success",
);

console.log(
    JSON.stringify(
        {
            backendMainIds,
            frontendMainIds,
            missingFrontend,
            missingBackend,
            lowTierRejectedByMainSet: backendLowIds.every(
                (id) => !backendMainIds.includes(id) && !frontendMainIds.includes(id),
            ),
            staticContracts: {
                strictResolveMainModel: true,
                backendMainModelSerialization: true,
                backendMainModelPatchValidation: true,
                selectedModelBackendCacheSync: true,
                independentReloadMutationArbitration: true,
                accountOptimisticClearOnSuccess: true,
            },
        },
        null,
        2,
    ),
);
