import { convertedPdfKey } from "./convert";
import { loadActiveVersion } from "./documentVersions";
import {
  downloadFile,
  extractedTextKey,
  storageKey,
  uploadFile,
} from "./storage";
import { createServerSupabase } from "./supabase";

// ---------------------------------------------------------------------------
// Shared document-copy core.
//
// Duplicates an existing document — bytes, PDF rendition, documents row and
// first version — one or more times. Extracted from the replicate_document
// tool so workflow reference documents can be materialised into a project the
// same way, with identical storage and versioning semantics.
// ---------------------------------------------------------------------------

/** Copy failed for a reason worth showing the caller verbatim. */
export class DocumentCopyError extends Error {}

export type DocumentCopySource = {
  documentId: string;
  filename: string;
  fileType: string;
  /** Fallback path used when the document has no active version row. */
  storagePath: string;
};

export type CopiedDocument = {
  document_id: string;
  version_id: string;
  filename: string;
  storage_path: string;
  file_type: string;
};

/**
 * Copy `source` once per entry in `filenames`. Every copy starts from the
 * source's active version, so accepted tracked changes are rolled in.
 */
export async function copyDocuments(params: {
  source: DocumentCopySource;
  filenames: string[];
  userId: string;
  db: ReturnType<typeof createServerSupabase>;
  projectId?: string | null;
  folderId?: string | null;
  originWorkflowDocumentId?: string | null;
  /** Noun used in failure messages, e.g. "replicated". */
  errorLabel?: string;
}): Promise<CopiedDocument[]> {
  const { source, filenames, userId, db } = params;
  const noun = params.errorLabel ?? "copied";
  if (filenames.length === 0) return [];

  // Pull the active version once — every copy gets the same starting bytes,
  // no point re-fetching per copy.
  const active = await loadActiveVersion(source.documentId, db);
  const sourcePath = active?.storage_path ?? source.storagePath;
  const sourcePdfPath = active?.pdf_storage_path ?? null;
  const raw = await downloadFile(sourcePath);
  const pdfBytes = sourcePdfPath ? await downloadFile(sourcePdfPath) : null;
  if (!raw) {
    throw new DocumentCopyError(
      "Could not read the source document's bytes from storage.",
    );
  }

  const fileType = active?.file_type ?? source.fileType;

  // Bulk insert N documents in one round-trip.
  const docRows = filenames.map((filename) => ({
    project_id: params.projectId ?? null,
    user_id: userId,
    status: "ready",
    filename,
    file_type: fileType,
    size_bytes: active?.size_bytes ?? raw.byteLength,
    page_count: active?.page_count ?? null,
    folder_id: params.folderId ?? null,
    origin_workflow_document_id: params.originWorkflowDocumentId ?? null,
  }));
  const { data: insertedDocs, error: docErr } = await db
    .from("documents")
    .insert(docRows)
    .select("id");
  if (docErr || !insertedDocs || insertedDocs.length === 0) {
    throw new DocumentCopyError(
      `Failed to record ${noun} documents: ${docErr?.message ?? "unknown"}`,
    );
  }

  // Preserve the request order so each row pairs with the right filename.
  // Supabase returns inserted rows in the same order as the payload.
  const newDocs = (insertedDocs as { id: string }[]).map((doc, idx) => ({
    ...doc,
    filename: filenames[idx] ?? "Untitled document.docx",
  }));
  const contentType =
    source.fileType === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  // Carry the source's cached text extraction over to every copy. The bytes
  // are identical, so the extraction is too — without this, each copy of a
  // workflow template would be re-extracted from scratch the first time it is
  // read, which for a scanned PDF means a full vision pass per project.
  const cachedExtraction = await downloadFile(extractedTextKey(sourcePath));

  // Parallel uploads: the doc bytes (and PDF rendition if any) for every copy.
  const uploadJobs: Promise<unknown>[] = [];
  const newKeys: string[] = [];
  const newPdfKeys: (string | null)[] = [];
  for (const d of newDocs) {
    const key = storageKey(userId, d.id, d.filename);
    newKeys.push(key);
    uploadJobs.push(uploadFile(key, raw, contentType));
    if (cachedExtraction && cachedExtraction.byteLength > 0) {
      uploadJobs.push(
        uploadFile(extractedTextKey(key), cachedExtraction, "text/plain"),
      );
    }
    if (pdfBytes) {
      const pdfKey = convertedPdfKey(userId, d.id);
      newPdfKeys.push(pdfKey);
      uploadJobs.push(uploadFile(pdfKey, pdfBytes, "application/pdf"));
    } else {
      newPdfKeys.push(null);
    }
  }
  await Promise.all(uploadJobs);

  // Bulk insert N versions in one round-trip.
  const versionRows = newDocs.map((d, idx) => ({
    document_id: d.id,
    storage_path: newKeys[idx],
    pdf_storage_path: newPdfKeys[idx],
    source: "upload",
    version_number: 1,
    filename: d.filename,
    file_type: fileType,
    size_bytes: active?.size_bytes ?? raw.byteLength,
    page_count: active?.page_count ?? null,
  }));
  const { data: insertedVersions, error: verErr } = await db
    .from("document_versions")
    .insert(versionRows)
    .select("id, document_id");
  if (
    verErr ||
    !insertedVersions ||
    insertedVersions.length !== newDocs.length
  ) {
    throw new DocumentCopyError(
      `Failed to record ${noun} document versions: ${verErr?.message ?? "unknown"}`,
    );
  }

  const versionByDocId = new Map<string, string>();
  for (const v of insertedVersions as { id: string; document_id: string }[]) {
    versionByDocId.set(v.document_id, v.id);
  }

  // current_version_id has to be a per-row value, so a single UPDATE can't
  // cover all N. Fan out in parallel instead of sequential awaits.
  await Promise.all(
    newDocs.map((d) =>
      db
        .from("documents")
        .update({ current_version_id: versionByDocId.get(d.id) })
        .eq("id", d.id),
    ),
  );

  const copies: CopiedDocument[] = [];
  for (let idx = 0; idx < newDocs.length; idx++) {
    const d = newDocs[idx];
    const versionId = versionByDocId.get(d.id);
    if (!versionId) continue;
    copies.push({
      document_id: d.id,
      version_id: versionId,
      filename: d.filename,
      storage_path: newKeys[idx],
      file_type: source.fileType,
    });
  }
  return copies;
}
