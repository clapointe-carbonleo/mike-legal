import { copyDocuments, DocumentCopyError } from "./documentCopy";
import { attachActiveVersionPaths } from "./documentVersions";
import { ensureProjectFolder } from "./projectFolders";
import { createServerSupabase } from "./supabase";

// ---------------------------------------------------------------------------
// Workflow reference documents.
//
// A workflow's template is owned by its author and lives outside any project,
// so `ensureDocAccess` makes it unreachable for anyone the workflow is merely
// shared with. Rather than widening document access, the backend — which holds
// the service key — copies the template into the running user's project when
// the workflow is applied. The copy is an ordinary project document: owned by
// the runner, visible in the sidebar, readable and editable by the model.
//
// Copies are snapshots. Updating the master template later does not change
// copies that already exist.
// ---------------------------------------------------------------------------

type Db = ReturnType<typeof createServerSupabase>;

/**
 * Resolve the project subfolder a workflow files its output into, creating it
 * on first use. Returns null when the workflow names no folder, so documents
 * keep landing at the project root.
 */
export async function resolveWorkflowOutputFolder(params: {
  workflowId: string;
  projectId: string | null;
  userId: string;
  db: Db;
}): Promise<string | null> {
  const { workflowId, projectId, userId, db } = params;
  if (!projectId) return null;

  const { data: workflow } = await db
    .from("workflows")
    .select("output_folder_name")
    .eq("id", workflowId)
    .maybeSingle();
  const name = (workflow?.output_folder_name as string | null)?.trim();
  if (!name) return null;

  return ensureProjectFolder({ projectId, userId, name, db });
}

export type MaterializedWorkflowDoc = {
  document_id: string;
  filename: string;
  reused: boolean;
};

/**
 * Ensure every reference document attached to `workflowId` is present for this
 * run, copying the ones that are missing. Inside a project the copy is a
 * project document; in the general assistant it is a standalone document owned
 * by the runner, which `buildDocContext` can still surface. Idempotent either
 * way, so re-running a workflow never duplicates the template.
 */
export async function materializeWorkflowDocuments(params: {
  workflowId: string;
  projectId: string | null;
  userId: string;
  db: Db;
  folderId?: string | null;
}): Promise<MaterializedWorkflowDoc[]> {
  const { workflowId, projectId, userId, db } = params;

  const { data: links } = await db
    .from("workflow_documents")
    .select("id, document_id")
    .eq("workflow_id", workflowId);
  if (!links || links.length === 0) return [];

  const linkIds = links.map((link) => link.id as string);

  // Which templates does this destination already hold a copy of? Inside a
  // project that is scoped to the project; in the general assistant, where
  // there is no project, it is scoped to the running user's standalone
  // documents so a re-run still reuses the copy rather than piling them up.
  const existingQuery = db
    .from("documents")
    .select("id, filename, origin_workflow_document_id")
    .in("origin_workflow_document_id", linkIds);
  const { data: existing } = await (projectId
    ? existingQuery.eq("project_id", projectId)
    : existingQuery.eq("user_id", userId).is("project_id", null));
  const existingByOrigin = new Map<string, { id: string; filename: string }>();
  for (const row of existing ?? []) {
    existingByOrigin.set(row.origin_workflow_document_id as string, {
      id: row.id as string,
      filename: (row.filename as string) ?? "",
    });
  }

  const pending = links.filter((link) => !existingByOrigin.has(link.id));
  const results: MaterializedWorkflowDoc[] = [];
  for (const link of links) {
    const already = existingByOrigin.get(link.id as string);
    if (already) {
      results.push({
        document_id: already.id,
        filename: already.filename,
        reused: true,
      });
    }
  }
  if (pending.length === 0) return results;

  const { data: sources } = await db
    .from("documents")
    .select("id, filename, file_type, current_version_id")
    .in(
      "id",
      pending.map((link) => link.document_id as string),
    );
  const sourceRows = (sources ?? []) as {
    id: string;
    filename?: string | null;
    file_type?: string | null;
    current_version_id?: string | null;
    storage_path?: string;
  }[];
  await attachActiveVersionPaths(db, sourceRows);
  const sourceById = new Map(sourceRows.map((row) => [row.id, row]));

  for (const link of pending) {
    const source = sourceById.get(link.document_id as string);
    // A template whose bytes have gone missing is skipped rather than fatal:
    // the run continues and the model reports the template as unavailable.
    if (!source?.storage_path) continue;
    const filename = source.filename?.trim() || "Document de référence.docx";
    try {
      const [copy] = await copyDocuments({
        source: {
          documentId: source.id,
          filename,
          fileType: source.file_type ?? "docx",
          storagePath: source.storage_path,
        },
        filenames: [filename],
        userId,
        db,
        projectId: projectId ?? null,
        folderId: projectId ? (params.folderId ?? null) : null,
        originWorkflowDocumentId: link.id as string,
        errorLabel: "workflow reference",
      });
      if (copy) {
        results.push({
          document_id: copy.document_id,
          filename: copy.filename,
          reused: false,
        });
      }
    } catch (e) {
      // Never fail the user's turn because a template could not be copied.
      console.error(
        "[materializeWorkflowDocuments] copy failed:",
        e instanceof DocumentCopyError ? e.message : e,
      );
    }
  }
  return results;
}
