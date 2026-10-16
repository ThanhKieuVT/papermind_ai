/**
 * Builds a small, valid PDF in memory for tests. Each entry in `pages` is a list of
 * text lines drawn with Helvetica; an empty list produces a page with no text
 * (behaves like a scanned / image-only page for extraction purposes).
 */
export function makePdf(pages: string[][], info?: { title?: string; author?: string }): Uint8Array {
  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length; // object number
  };
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const catalogNum = add(""); // placeholder, filled below
  const pagesNum = add("");
  const fontNum = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageNums: number[] = [];
  for (const lines of pages) {
    const ops = lines.length
      ? `BT /F1 12 Tf 14 TL 72 720 Td ${lines.map((l) => `(${esc(l)}) Tj T*`).join(" ")} ET`
      : "0.9 g 72 72 468 648 re f"; // a filled rectangle, no text
    const contentNum = add(`<< /Length ${ops.length} >>\nstream\n${ops}\nendstream`);
    pageNums.push(
      add(
        `<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontNum} 0 R >> >> /Contents ${contentNum} 0 R >>`,
      ),
    );
  }
  objects[catalogNum - 1] = `<< /Type /Catalog /Pages ${pagesNum} 0 R >>`;
  objects[pagesNum - 1] = `<< /Type /Pages /Kids [${pageNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageNums.length} >>`;
  let infoNum: number | null = null;
  if (info) {
    const fields = [info.title ? `/Title (${esc(info.title)})` : "", info.author ? `/Author (${esc(info.author)})` : ""].join(" ");
    infoNum = add(`<< ${fields} >>`);
  }

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogNum} 0 R${infoNum ? ` /Info ${infoNum} 0 R` : ""} >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
