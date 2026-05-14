import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { singleFileUpload } from "../lib/upload";
import { createServerSupabase } from "../lib/supabase";
import { downloadFile } from "../lib/storage";

const pageindexRouter = Router();

const PAGEINDEX_URL = process.env.PAGEINDEX_URL ?? "http://localhost:8000";
const PAGEINDEX_SECRET = process.env.PAGEINDEX_SECRET ?? "";

function pageindexHeaders(): Record<string, string> {
  return PAGEINDEX_SECRET ? { "x-api-secret": PAGEINDEX_SECRET } : {};
}

// Index a raw PDF upload — returns doc_id, caller manages storage
pageindexRouter.post(
  "/index",
  requireAuth,
  singleFileUpload("file"),
  async (req, res) => {
    const file = req.file;
    if (!file)
      return void res.status(400).json({ detail: "No file provided." });
    if (!file.originalname.toLowerCase().endsWith(".pdf"))
      return void res
        .status(400)
        .json({ detail: "Only PDF files are supported." });

    const form = new FormData();
    form.append(
      "file",
      new Blob([file.buffer], { type: "application/pdf" }),
      file.originalname,
    );

    const upstream = await fetch(`${PAGEINDEX_URL}/index`, {
      method: "POST",
      body: form,
      headers: pageindexHeaders(),
      signal: AbortSignal.timeout(600_000),
    });
    const data = await upstream.json();
    if (!upstream.ok) return void res.status(upstream.status).json(data);
    return void res.json(data);
  },
);

// Index a document already in R2, save pageindex_doc_id back to Supabase
pageindexRouter.post("/index-document", requireAuth, async (req, res) => {
  const { document_id } = req.body as { document_id?: string };
  if (!document_id)
    return void res.status(400).json({ detail: "document_id is required." });

  const userId = res.locals.userId as string;
  const db = createServerSupabase();

  const { data: doc, error: docErr } = await db
    .from("documents")
    .select("id, filename, user_id")
    .eq("id", document_id)
    .eq("user_id", userId)
    .single();

  if (docErr || !doc)
    return void res.status(404).json({ detail: "Document not found." });

  const { data: version, error: vErr } = await db
    .from("document_versions")
    .select("storage_path, pdf_storage_path")
    .eq("document_id", document_id)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  if (vErr || !version)
    return void res
      .status(404)
      .json({ detail: "No version found for document." });

  const storagePath = version.pdf_storage_path ?? version.storage_path;
  const fileBuffer = await downloadFile(storagePath);

  if (!fileBuffer)
    return void res
      .status(500)
      .json({ detail: "Failed to download document from storage." });

  const filename = doc.filename.toLowerCase().endsWith(".pdf")
    ? doc.filename
    : doc.filename.replace(/\.[^.]+$/, ".pdf");

  const form = new FormData();
  form.append(
    "file",
    new Blob([fileBuffer], { type: "application/pdf" }),
    filename,
  );

  const upstream = await fetch(`${PAGEINDEX_URL}/index`, {
    method: "POST",
    body: form,
    headers: pageindexHeaders(),
    signal: AbortSignal.timeout(600_000),
  });
  const data = (await upstream.json()) as { doc_id?: string };
  if (!upstream.ok) return void res.status(upstream.status).json(data);

  await db
    .from("documents")
    .update({ pageindex_doc_id: data.doc_id })
    .eq("id", document_id);

  return void res.json({ pageindex_doc_id: data.doc_id });
});

// Query an indexed document using its Supabase document_id
pageindexRouter.post("/query", requireAuth, async (req, res) => {
  const { document_id, question } = req.body as {
    document_id?: string;
    question?: string;
  };
  if (!document_id || !question)
    return void res
      .status(400)
      .json({ detail: "document_id and question are required." });

  const userId = res.locals.userId as string;
  const db = createServerSupabase();
  const { data: doc } = await db
    .from("documents")
    .select("pageindex_doc_id")
    .eq("id", document_id)
    .eq("user_id", userId)
    .single();

  if (!doc?.pageindex_doc_id)
    return void res.status(400).json({
      detail:
        "Document has not been indexed yet. Call /pageindex/index-document first.",
    });

  const upstream = await fetch(`${PAGEINDEX_URL}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...pageindexHeaders(),
    },
    body: JSON.stringify({ doc_id: doc.pageindex_doc_id, question }),
    signal: AbortSignal.timeout(300_000),
  });
  const data = await upstream.json();
  if (!upstream.ok) return void res.status(upstream.status).json(data);
  return void res.json(data);
});

export { pageindexRouter };
