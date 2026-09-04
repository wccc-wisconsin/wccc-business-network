"use client";

import { useState, useTransition } from "react";
import type { ModuleTool } from "@/data/modules";
import type { MemberDocument } from "@/lib/appStore";

type Props = {
  moduleKey: string;
  tools: ModuleTool[];
  /** Previously generated documents for this module, newest first. */
  initialDocuments: MemberDocument[];
};

type Generated = {
  title: string;
  content: string;
  createdAt: string;
  saved: boolean;
  /** The reply hit its token ceiling, so the document stops mid-sentence. */
  truncated: boolean;
};

// Renders a module's document generators. Each button produces a real
// document written from the member's saved guided-step answers — see
// app/api/ai/document/route.ts and the `tools` array in data/modules.ts.
export default function ModuleToolkit({ moduleKey, tools, initialDocuments }: Props) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Documents already saved, plus anything generated in this session, so a
  // member sees their new document join the list without a page reload.
  const [documents, setDocuments] = useState<MemberDocument[]>(initialDocuments);

  function generate(tool: ModuleTool) {
    setActiveKey(tool.key);
    setError(null);
    setGenerated(null);
    setCopied(false);

    startTransition(async () => {
      try {
        const res = await fetch("/api/ai/document", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ moduleKey, toolKey: tool.key }),
        });
        const data = await res.json();

        if (!data.ok) {
          setError(data.error || "Something went wrong.");
          return;
        }

        const doc: Generated = {
          ...data.document,
          saved: data.saved,
          // Defaulted rather than trusted: an older deploy of the route does
          // not send this field, and `undefined` would render the warning as
          // absent — which is the right answer, but only by accident.
          truncated: data.truncated === true,
        };
        setGenerated(doc);

        if (data.saved) {
          setDocuments((prev) => [
            {
              id: `new-${Date.now()}`,
              moduleKey,
              toolKey: tool.key,
              title: doc.title,
              content: doc.content,
              createdAt: doc.createdAt,
            },
            ...prev,
          ]);
        }
      } catch {
        setError("Couldn't reach the AI assistant. Please try again.");
      }
    });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked by permissions or an insecure context. The
      // text is on screen and selectable either way, so this isn't worth an
      // error state — just don't claim it copied.
      setCopied(false);
    }
  }

  return (
    <div className="rounded-[8px] border border-white/10 bg-[#132f52] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#d7a84d]">Toolkit</p>
      <h2 className="mt-1 font-serif text-xl font-bold text-white">Build it for my business</h2>
      <p className="mt-1 text-sm text-white/50">
        Each one is written from the answers you&apos;ve saved in this module — not a blank
        template.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {tools.map((tool) => (
          <div
            key={tool.key}
            className="flex flex-col rounded-[8px] border border-white/10 bg-white/5 p-4"
          >
            <p className="text-sm font-bold text-white">{tool.title}</p>
            <p className="mt-1 flex-1 text-xs leading-5 text-white/55">{tool.description}</p>
            <button
              type="button"
              onClick={() => generate(tool)}
              disabled={isPending}
              className="mt-4 rounded-full bg-[#d7a84d] px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-[#0f2d4a] transition hover:bg-[#e8bd6a] disabled:opacity-50"
            >
              {isPending && activeKey === tool.key ? "Writing…" : "Generate"}
            </button>
          </div>
        ))}
      </div>

      {error && <p className="mt-4 text-sm font-semibold text-red-400">{error}</p>}

      {generated && (
        <div className="mt-5 rounded-[8px] border border-[#d7a84d]/25 bg-[#d7a84d]/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-serif text-lg font-bold text-white">{generated.title}</h3>
            <button
              type="button"
              onClick={() => copy(generated.content)}
              className="rounded-full border border-[#d7a84d]/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#d7a84d] transition hover:bg-[#d7a84d]/10"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/85">
            {generated.content}
          </p>

          {generated.truncated && (
            <p className="mt-4 text-xs text-amber-300">
              This ran to its length limit and stops mid-sentence — generate it again
              before you hand it to anyone.
            </p>
          )}

          {!generated.saved && (
            <p className="mt-4 text-xs text-amber-300">
              Couldn&apos;t save this one — copy it before you leave the page.
            </p>
          )}
        </div>
      )}

      {documents.length > 0 && (
        <details className="mt-5 rounded-[8px] border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-bold text-white">
            Saved documents ({documents.length})
          </summary>
          <div className="mt-4 space-y-4">
            {documents.map((doc) => (
              <div key={doc.id} className="rounded-[8px] border border-white/10 bg-[#0f2d4a] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-white">{doc.title}</p>
                  <span className="text-xs text-white/40">
                    {new Intl.DateTimeFormat("en", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(new Date(doc.createdAt))}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-white/70">
                  {doc.content}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
