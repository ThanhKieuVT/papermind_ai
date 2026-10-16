// Copies the PDF.js worker into /public so it is served from our own origin
// (no third-party CDN) in both development and production builds.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let source;
try {
  source = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
} catch {
  console.warn("[copy-pdf-worker] pdfjs-dist not installed yet; skipping.");
  process.exit(0);
}

const targetDir = join(root, "public");
if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
copyFileSync(source, join(targetDir, "pdf.worker.min.mjs"));
console.log("[copy-pdf-worker] public/pdf.worker.min.mjs updated");
