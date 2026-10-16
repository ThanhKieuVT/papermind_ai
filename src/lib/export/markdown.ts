import type { LibraryEntry, Paper } from "@/types/paper";

/** Escapes characters that would break a Markdown table cell. */
export function mdCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

export function paperCitationLine(paper: Paper): string {
  const authors = paper.authors.length === 0
    ? "Unknown authors"
    : paper.authors.length > 3
      ? `${paper.authors.slice(0, 3).join(", ")}, et al.`
      : paper.authors.join(", ");
  const parts = [authors, paper.year ? `(${paper.year})` : "(n.d.)", paper.title];
  if (paper.venue) parts.push(`*${paper.venue}*`);
  if (paper.doi) parts.push(`https://doi.org/${paper.doi}`);
  return parts.join(". ").replace(/\.\./g, ".");
}

export function libraryToMarkdown(entries: LibraryEntry[], exportedAt = new Date()): string {
  const lines: string[] = [
    "# PaperMind AI — Library export",
    "",
    `Exported: ${exportedAt.toISOString()}`,
    `Papers: ${entries.length}`,
    "",
  ];
  for (const e of entries) {
    const p = e.paper;
    lines.push(`## ${p.title}`, "");
    lines.push(`- **Authors:** ${p.authors.length ? p.authors.join(", ") : "Not available"}`);
    lines.push(`- **Year:** ${p.year ?? "Not available"}`);
    lines.push(`- **Venue:** ${p.venue ?? "Not available"}`);
    lines.push(`- **DOI:** ${p.doi ? `[${p.doi}](https://doi.org/${p.doi})` : "Not available"}`);
    if (p.url) lines.push(`- **Link:** ${p.url}`);
    lines.push(`- **Status:** ${e.status}`);
    lines.push(`- **Tags:** ${e.tags.length ? e.tags.map((t) => `\`${t}\``).join(" ") : "—"}`);
    lines.push("");
    if (p.abstract) lines.push("### Abstract", "", p.abstract, "");
    lines.push("### Notes", "", e.notes.trim() || "_No notes._", "");
  }
  return lines.join("\n");
}

export function libraryToJson(entries: LibraryEntry[], exportedAt = new Date()): string {
  return JSON.stringify({ app: "papermind-ai", version: 1, exportedAt: exportedAt.toISOString(), entries }, null, 2);
}

/** Triggers a client-side download of text content. */
export function downloadText(filename: string, content: string, mime = "text/markdown"): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
