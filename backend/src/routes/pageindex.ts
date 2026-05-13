import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { singleFileUpload } from "../lib/upload";

const pageindexRouter = Router();

const PAGEINDEX_URL = process.env.PAGEINDEX_URL ?? "http://localhost:8000";

pageindexRouter.post(
  "/index",
  requireAuth,
  singleFileUpload("file"),
  async (req, res) => {
    const file = req.file;
    if (!file) return void res.status(400).json({ detail: "No file provided." });
    if (!file.originalname.toLowerCase().endsWith(".pdf")) {
      return void res.status(400).json({ detail: "Only PDF files are supported." });
    }

    const form = new FormData();
    form.append(
      "file",
      new Blob([file.buffer], { type: "application/pdf" }),
      file.originalname,
    );

    const upstream = await fetch(`${PAGEINDEX_URL}/index`, {
      method: "POST",
      body: form,
    });

    const data = await upstream.json();
    if (!upstream.ok) return void res.status(upstream.status).json(data);
    return void res.json(data);
  },
);

pageindexRouter.post("/query", requireAuth, async (req, res) => {
  const { doc_id, question } = req.body as {
    doc_id?: string;
    question?: string;
  };
  if (!doc_id || !question) {
    return void res
      .status(400)
      .json({ detail: "doc_id and question are required." });
  }

  const upstream = await fetch(`${PAGEINDEX_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc_id, question }),
  });

  const data = await upstream.json();
  if (!upstream.ok) return void res.status(upstream.status).json(data);
  return void res.json(data);
});

export { pageindexRouter };
