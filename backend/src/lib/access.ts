import type { createServerSupabase } from "./supabase";

type Db = ReturnType<typeof createServerSupabase>;

export type ProjectAccess =
    | { ok: true; isOwner: boolean; project: { id: string; user_id: string; shared_with: string[] | null } }
    | { ok: false };

export async function checkProjectAccess(
    projectId: string,
    userId: string,
    userEmail: string | null | undefined,
    db: Db,
): Promise<ProjectAccess> {
    const { data: project } = await db
        .from("projects")
        .select("id, user_id, shared_with")
        .eq("id", projectId)
        .single();
    if (!project) return { ok: false };
    const isOwner = project.user_id === userId;
    const isShared =
        Array.isArray(project.shared_with) &&
        !!userEmail &&
        project.shared_with.includes(userEmail);
    if (!isOwner && !isShared) return { ok: false };
    return { ok: true, isOwner, project: project as { id: string; user_id: string; shared_with: string[] | null } };
}

export async function ensureDocAccess(
    doc: { user_id: string; project_id: string | null },
    userId: string,
    userEmail: string | null | undefined,
    db: Db,
): Promise<{ ok: true; isOwner: boolean } | { ok: false }> {
    if (doc.user_id === userId) return { ok: true, isOwner: true };
    if (doc.project_id) {
        const projectAccess = await checkProjectAccess(doc.project_id, userId, userEmail, db);
        if (projectAccess.ok) return { ok: true, isOwner: false };
    }
    return { ok: false };
}

export async function ensureReviewAccess(
    review: { user_id: string; project_id: string | null; shared_with?: string[] | null },
    userId: string,
    userEmail: string | null | undefined,
    db: Db,
): Promise<{ ok: true; isOwner: boolean } | { ok: false }> {
    if (review.user_id === userId) return { ok: true, isOwner: true };
    if (
        Array.isArray(review.shared_with) &&
        userEmail &&
        review.shared_with.includes(userEmail)
    ) {
        return { ok: true, isOwner: false };
    }
    if (review.project_id) {
        const projectAccess = await checkProjectAccess(review.project_id, userId, userEmail, db);
        if (projectAccess.ok) return { ok: true, isOwner: false };
    }
    return { ok: false };
}

export async function listAccessibleProjectIds(
    userId: string,
    userEmail: string | null | undefined,
    db: Db,
): Promise<string[]> {
    const { data } = await db
        .from("projects")
        .select("id, user_id, shared_with");
    return (data ?? [])
        .filter(
            (p: { id: string; user_id: string; shared_with: string[] | null }) =>
                p.user_id === userId ||
                (Array.isArray(p.shared_with) && !!userEmail && p.shared_with.includes(userEmail)),
        )
        .map((p: { id: string }) => p.id);
}
