"use client";

import { useState } from "react";
import type { Paper } from "@/types/paper";
import { Badge, Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { savePaper } from "@/lib/storage/library";
import { errorMessage } from "@/lib/api/client";

export function formatAuthors(authors: string[], max = 4): string {
  if (authors.length === 0) return "Authors not available";
  return authors.length > max ? `${authors.slice(0, max).join(", ")} +${authors.length - max} more` : authors.join(", ");
}

export function PaperBadges({ paper }: { paper: Paper }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {paper.year && <Badge>{paper.year}</Badge>}
      {paper.citationCount !== null && <Badge tone="blue">{paper.citationCount.toLocaleString()} citations</Badge>}
      {paper.isOpenAccess && <Badge tone="green">Open access</Badge>}
      {paper.pdfUrl && <Badge tone="violet">PDF available</Badge>}
      {paper.source === "local" && <Badge tone="amber">Uploaded PDF</Badge>}
    </div>
  );
}

export function SourceLinks({ paper }: { paper: Paper }) {
  return (
    <div className="flex flex-wrap gap-3 text-sm">
      {paper.url && (
        <a href={paper.url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">
          Publisher / source ↗
        </a>
      )}
      {paper.pdfUrl && (
        <a href={paper.pdfUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">
          Open-access PDF ↗
        </a>
      )}
      {paper.doi && (
        <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer" className="text-stone-600 underline-offset-2 hover:underline dark:text-stone-300">
          DOI: {paper.doi}
        </a>
      )}
      {!paper.url && !paper.pdfUrl && !paper.doi && <span className="text-stone-500">No source link available</span>}
    </div>
  );
}

export function SaveToLibraryButton({ paper, size = "sm", saved = false }: { paper: Paper; size?: "sm" | "md"; saved?: boolean }) {
  const notify = useToast();
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const isSaved = saved || state === "saved";
  return (
    <Button
      size={size}
      variant={isSaved ? "secondary" : "primary"}
      loading={state === "saving"}
      disabled={isSaved}
      onClick={async () => {
        setState("saving");
        try {
          const result = await savePaper(paper);
          notify(result.status === "saved" ? "Saved to your library." : "This paper is already in your library.", result.status === "saved" ? "success" : "info");
          setState("saved");
        } catch (e) {
          notify(`Could not save: ${errorMessage(e)}`, "error");
          setState("idle");
        }
      }}
    >
      {isSaved ? "✓ In library" : "Save to library"}
    </Button>
  );
}
