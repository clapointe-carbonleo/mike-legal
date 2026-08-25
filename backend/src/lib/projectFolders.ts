import { createServerSupabase } from "./supabase";

/**
 * Resolve a project subfolder by name, creating it at the project root if it
 * does not exist yet. Returns null when the folder cannot be resolved, so
 * callers fall back to filing at the project root rather than failing.
 */
export async function ensureProjectFolder(params: {
  projectId: string;
  userId: string;
  name: string;
  db: ReturnType<typeof createServerSupabase>;
}): Promise<string | null> {
  const { projectId, userId, db } = params;
  const name = params.name.trim();
  if (!name) return null;

  const { data: existing } = await db
    .from("project_subfolders")
    .select("id")
    .eq("project_id", projectId)
    .eq("name", name)
    .is("parent_folder_id", null)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data, error } = await db
    .from("project_subfolders")
    .insert({
      project_id: projectId,
      user_id: userId,
      name,
      parent_folder_id: null,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[ensureProjectFolder] insert failed:", error);
    return null;
  }
  return data.id as string;
}
