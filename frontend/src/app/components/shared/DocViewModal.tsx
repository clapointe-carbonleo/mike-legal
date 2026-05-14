"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Loader2, MessageCircle, Send, Trash2, X } from "lucide-react";
import { DocView } from "./DocView";
import { getDocumentUrl, indexDocument, queryDocument } from "@/app/lib/mikeApi";
import type { MikeDocument } from "./types";

interface Props {
    doc: MikeDocument | null;
    /** Optional specific version to display. Only honoured for DOCX. */
    versionId?: string | null;
    /** Optional label suffix for the header (e.g. "V3"). */
    versionLabel?: string | null;
    onClose: () => void;
    onDelete?: (doc: MikeDocument) => void;
}

interface QAMessage {
    role: "user" | "assistant";
    content: string;
}

type IndexStatus = "idle" | "indexing" | "ready" | "error";

export function DocViewModal({
    doc,
    versionId,
    versionLabel,
    onClose,
    onDelete,
}: Props) {
    const [mounted, setMounted] = useState(false);
    const [qaOpen, setQaOpen] = useState(false);
    const [indexStatus, setIndexStatus] = useState<IndexStatus>("idle");
    const [messages, setMessages] = useState<QAMessage[]>([]);
    const [question, setQuestion] = useState("");
    const [asking, setAsking] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (qaOpen) inputRef.current?.focus();
    }, [qaOpen, indexStatus]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const isPdf = doc?.filename?.toLowerCase().endsWith(".pdf") ?? false;

    if (!doc || !mounted) return null;

    async function handleDownload() {
        if (!doc) return;
        const { url, filename } = await getDocumentUrl(doc.id, versionId ?? null);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
    }

    async function handleIndex() {
        if (!doc) return;
        setIndexStatus("indexing");
        try {
            await indexDocument(doc.id);
            setIndexStatus("ready");
        } catch {
            setIndexStatus("error");
        }
    }

    async function handleAsk() {
        if (!doc || !question.trim() || asking) return;
        const q = question.trim();
        setQuestion("");
        setAsking(true);
        setMessages((prev) => [...prev, { role: "user", content: q }]);
        try {
            const { answer } = await queryDocument(doc.id, q);
            setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
        } catch {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Erreur lors de la requête. Réessaie." },
            ]);
        } finally {
            setAsking(false);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleAsk();
        }
    }

    const showQaPanel = qaOpen && isPdf;

    return createPortal(
        <div
            className="fixed inset-0 z-100 flex items-center justify-center bg-[#292629]/40"
            onClick={onClose}
        >
            <div
                className={`relative flex flex-col bg-white rounded-xl shadow-2xl max-w-[92vw] h-[90vh] transition-all duration-300 ${showQaPanel ? "w-[1200px]" : "w-[800px]"}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 shrink-0">
                    <span className="text-base font-medium font-sans text-[#292629]/90 truncate pr-4">
                        {doc.filename}
                        {versionLabel && (
                            <span className="ml-2 text-xs font-normal text-[#292629]/50">
                                {versionLabel}
                            </span>
                        )}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                        {isPdf && (
                            <button
                                onClick={() => setQaOpen((v) => !v)}
                                title="Poser une question sur ce document"
                                className={`flex items-center justify-center w-6 h-6 rounded transition-colors ${qaOpen ? "bg-[#292629]/10 text-[#292629]/80" : "hover:bg-[#F5F5F5] text-[#292629]/40 hover:text-[#292629]/80"}`}
                            >
                                <MessageCircle className="h-4 w-4" />
                            </button>
                        )}
                        <button
                            onClick={handleDownload}
                            className="flex items-center justify-center w-6 h-6 rounded hover:bg-[#F5F5F5] text-[#292629]/40 hover:text-[#292629]/80 transition-colors"
                        >
                            <Download className="h-4 w-4" />
                        </button>
                        {onDelete && (
                            <button
                                onClick={() => { onDelete(doc); onClose(); }}
                                className="flex items-center justify-center w-6 h-6 rounded hover:bg-red-50 text-[#292629]/40 hover:text-red-500 transition-colors"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="flex items-center justify-center w-6 h-6 rounded hover:bg-[#F5F5F5] text-[#292629]/40 hover:text-[#292629]/80 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex flex-1 overflow-hidden px-3 pb-3 gap-3">
                    {/* Document viewer */}
                    <div className={`flex flex-col ${showQaPanel ? "w-[55%]" : "w-full"} overflow-hidden`}>
                        <DocView
                            key={versionId ?? "current"}
                            doc={{
                                document_id: doc.id,
                                version_id: versionId ?? null,
                            }}
                        />
                    </div>

                    {/* Q&A panel */}
                    {showQaPanel && (
                        <div className="flex flex-col w-[45%] border border-[#E8E8E8] rounded-lg overflow-hidden">
                            {indexStatus === "idle" && (
                                <div className="flex flex-col items-center justify-center flex-1 gap-3 p-6 text-center">
                                    <MessageCircle className="h-8 w-8 text-[#292629]/20" />
                                    <p className="text-sm text-[#292629]/60">
                                        Analyse le document pour pouvoir poser des questions dessus.
                                    </p>
                                    <button
                                        onClick={handleIndex}
                                        className="px-4 py-2 text-sm font-medium bg-[#292629] text-white rounded-lg hover:bg-[#292629]/80 transition-colors"
                                    >
                                        Analyser ce document
                                    </button>
                                </div>
                            )}

                            {indexStatus === "indexing" && (
                                <div className="flex flex-col items-center justify-center flex-1 gap-2 p-6">
                                    <Loader2 className="h-6 w-6 animate-spin text-[#292629]/40" />
                                    <p className="text-sm text-[#292629]/60">Indexation en cours…</p>
                                </div>
                            )}

                            {indexStatus === "error" && (
                                <div className="flex flex-col items-center justify-center flex-1 gap-3 p-6 text-center">
                                    <p className="text-sm text-red-500">Erreur d'indexation.</p>
                                    <button
                                        onClick={handleIndex}
                                        className="px-3 py-1.5 text-sm font-medium border border-[#E8E8E8] rounded-lg hover:bg-[#F5F5F5] transition-colors"
                                    >
                                        Réessayer
                                    </button>
                                </div>
                            )}

                            {indexStatus === "ready" && (
                                <>
                                    {/* Messages */}
                                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                                        {messages.length === 0 && (
                                            <p className="text-xs text-[#292629]/40 text-center mt-4">
                                                Pose une question sur ce contrat.
                                            </p>
                                        )}
                                        {messages.map((m, i) => (
                                            <div
                                                key={i}
                                                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                                            >
                                                <div
                                                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                                                        m.role === "user"
                                                            ? "bg-[#292629] text-white"
                                                            : "bg-[#F5F5F5] text-[#292629]"
                                                    }`}
                                                >
                                                    {m.content}
                                                </div>
                                            </div>
                                        ))}
                                        {asking && (
                                            <div className="flex justify-start">
                                                <div className="bg-[#F5F5F5] rounded-lg px-3 py-2">
                                                    <Loader2 className="h-4 w-4 animate-spin text-[#292629]/40" />
                                                </div>
                                            </div>
                                        )}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* Input */}
                                    <div className="shrink-0 border-t border-[#E8E8E8] p-2 flex gap-2 items-end">
                                        <textarea
                                            ref={inputRef}
                                            value={question}
                                            onChange={(e) => setQuestion(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="Pose une question…"
                                            rows={2}
                                            className="flex-1 resize-none text-sm border border-[#E8E8E8] rounded-lg px-3 py-2 focus:outline-none focus:border-[#292629]/30 placeholder:text-[#292629]/30"
                                        />
                                        <button
                                            onClick={handleAsk}
                                            disabled={!question.trim() || asking}
                                            className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#292629] text-white disabled:opacity-30 hover:bg-[#292629]/80 transition-colors shrink-0"
                                        >
                                            <Send className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}
