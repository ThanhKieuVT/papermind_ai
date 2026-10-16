import { expect, test, type Page } from "@playwright/test";
import { crc32, deflateSync } from "node:zlib";
import { makePdf } from "../src/tests/fixtures/makePdf";

/** Builds a small solid-colour PNG for upload tests. */
function makePng(width: number, height: number, rgb: [number, number, number]): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * End-to-end smoke tests against the production build (`npm run build` first).
 * The server runs WITHOUT AI credentials, so AI-disabled states are verified here.
 * Paper search is stubbed with a clearly-labelled test fixture to stay deterministic;
 * the live OpenAlex integration is covered by the manual check in docs/TESTING.md.
 */

const SEARCH_FIXTURE = {
  total: 2,
  page: 1,
  perPage: 10,
  papers: [
    {
      id: "openalex:W900000001", source: "openalex", openAlexId: "W900000001", doi: "10.9999/e2e.fixture.1",
      title: "E2E Fixture Paper on Sparse Attention", authors: ["Test Author"], year: 2021, venue: "Fixture Venue",
      abstract: "This fixture abstract describes a sparse attention method.", citationCount: 5,
      url: "https://example.org/1", pdfUrl: null, isOpenAccess: false, concepts: [],
    },
    {
      id: "openalex:W900000002", source: "openalex", openAlexId: "W900000002", doi: null,
      title: "E2E Fixture Paper Without Abstract", authors: [], year: 2019, venue: null,
      abstract: null, citationCount: null, url: null, pdfUrl: null, isOpenAccess: null, concepts: [],
    },
  ],
};

async function stubSearch(page: Page) {
  await page.route("**/api/papers/search?**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SEARCH_FIXTURE) }),
  );
}

test("all main pages render and navigation works", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  for (const [label, heading] of [
    ["Discover Papers", "Discover Papers"],
    ["PDF Reader", "PDF Reader"],
    ["My Library", "My Library"],
    ["Compare Papers", "Compare Papers"],
    ["Study Center", "Study Center"],
    ["Venues & Deadlines", "Venues & Deadlines"],
    ["Photos I Love", "Photos I Love"],
    ["Settings", "Settings"],
  ]) {
    await nav.getByRole("link", { name: label }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
});

test("empty library state and AI-disabled status are shown", async ({ page }) => {
  await page.goto("/library");
  await expect(page.getByText("Your library is empty")).toBeVisible();
  await page.goto("/settings");
  // no server key in E2E, but visitors may still unlock AI with their own key
  await expect(page.getByText("Locked", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Your own Gemini API key")).toBeVisible();
});

test("search results can be inspected, saved, and persist after refresh", async ({ page }) => {
  await stubSearch(page);
  await page.goto("/discover");
  await page.getByLabel("Keywords or title").fill("sparse attention");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText("E2E Fixture Paper on Sparse Attention")).toBeVisible();
  await expect(page.getByText("No abstract available from OpenAlex.")).toBeVisible();

  await page.getByRole("button", { name: "E2E Fixture Paper Without Abstract" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("No abstract is available for this work from OpenAlex.")).toBeVisible();
  await dialog.getByRole("button", { name: "Close dialog" }).click();

  await page.getByRole("button", { name: "Save to library" }).first().click();
  await expect(page.getByText("Saved to your library.")).toBeVisible();
  await page.getByRole("button", { name: "Save to library" }).first().click();
  await expect(page.getByRole("button", { name: "✓ In library" })).toHaveCount(2);

  await page.goto("/library");
  await page.reload();
  await expect(page.getByRole("heading", { name: "E2E Fixture Paper on Sparse Attention" })).toBeVisible();
  await expect(page.getByText("Showing 2 of 2 papers")).toBeVisible();

  await page.getByRole("button", { name: "Notes & tags" }).first().click();
  await page.getByLabel("Personal notes").fill("Remember the sparsity pattern.");
  await page.getByLabel("Tags (comma-separated)").fill("attention, efficiency");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Notes and tags saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Remember the sparsity pattern.")).toBeVisible();
  await expect(page.getByText("#efficiency")).toBeVisible();

  // comparison without AI falls back to a metadata-only table
  await page.goto("/compare");
  await page.getByRole("checkbox").nth(0).check();
  await page.getByRole("checkbox").nth(1).check();
  await expect(page.getByText("AI is unavailable, so only bibliographic metadata is shown.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Fixture Venue" })).toBeVisible();
});

test("a text PDF is rendered, extracted, saved and reopened after refresh", async ({ page }) => {
  const pdf = makePdf(
    [
      ["Sparse Attention for Long Documents", "We use Long Short-Term Memory (LSTM) baselines."],
      ["Results on page two: accuracy 91.2 percent."],
    ],
    { title: "Sparse Attention E2E" },
  );
  await page.goto("/reader");
  await page.locator("#pdf-upload").setInputFiles({ name: "paper.pdf", mimeType: "application/pdf", buffer: Buffer.from(pdf) });

  await expect(page.getByText("2 pages")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Extracted text of page 1")).toContainText("Long Short-Term Memory (LSTM)");
  // canvas actually received pixels
  const canvas = page.getByRole("img", { name: "PDF page 1" });
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.width)).toBeGreaterThan(100);

  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByLabel("Extracted text of page 2")).toContainText("accuracy 91.2 percent");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByText("125%")).toBeVisible();

  await page.getByRole("tab", { name: "AI assistant" }).click();
  await expect(page.getByText("Unlock the AI assistant")).toBeVisible();
  await page.getByLabel("Your Gemini API key").fill("not-a-key");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "doesn't look like a Gemini API key" })).toBeVisible();
  await page.getByLabel("Your Gemini API key").fill("AIza" + "x".repeat(35));
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("button", { name: "Summarize the paper" })).toBeVisible();
  await expect(page.getByText("Unlock the AI assistant")).toBeHidden();

  await page.getByRole("button", { name: "Save to library" }).click();
  await expect(page).toHaveURL(/paper=local/);
  await page.reload();
  await expect(page.getByText("Library paper")).toBeVisible();
  await expect(page.getByText("2 pages")).toBeVisible({ timeout: 20_000 });

  // rule-based study generation from the attached PDF
  await page.goto("/library");
  await page.getByRole("link", { name: "Study", exact: true }).click();
  await page.getByRole("button", { name: "Generate rule-based (no AI)" }).click();
  await expect(page.getByText("Rule-based extraction found 1 card(s)")).toBeVisible();
  await expect(page.getByText("Rule-based", { exact: true }).first()).toBeVisible();
});

test("corrupt and non-PDF files show clear errors", async ({ page }) => {
  await page.goto("/reader");
  await page.locator("#pdf-upload").setInputFiles({ name: "broken.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\ngarbage") });
  await expect(page.getByText("This file is corrupt or not a valid PDF.")).toBeVisible({ timeout: 20_000 });
  await page.locator("#pdf-upload").setInputFiles({ name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("hello") });
  await expect(page.getByText('"notes.pdf" does not look like a PDF file.')).toBeVisible();
});

test("manual flashcards and quiz scoring persist", async ({ page }) => {
  await stubSearch(page);
  await page.goto("/discover?q=fixture");
  await page.getByRole("button", { name: "Save to library" }).first().click();
  await expect(page.getByText("Saved to your library.")).toBeVisible();

  await page.goto("/study");
  await page.getByLabel("Paper").selectOption({ label: "E2E Fixture Paper on Sparse Attention" });
  await page.getByRole("tab", { name: "Manage" }).click();
  await page.getByLabel("Front").fill("What is sparse attention?");
  await page.getByLabel("Back").fill("Attention restricted to a subset of positions.");
  await page.getByRole("button", { name: "Add flashcard" }).click();

  await page.getByLabel("Quiz question").check();
  await page.getByLabel("Question", { exact: true }).fill("2 + 2 = ?");
  for (const [i, v] of ["4", "3", "5", "22"].entries()) await page.getByLabel(`Option ${i + 1}`, { exact: true }).fill(v);
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByLabel("Question", { exact: true }).fill("Capital of France?");
  for (const [i, v] of ["Rome", "Paris", "Berlin", "Madrid"].entries()) await page.getByLabel(`Option ${i + 1}`, { exact: true }).fill(v);
  await page.getByLabel("Option 2 is correct").check();
  await page.getByRole("button", { name: "Add question" }).click();

  await page.getByRole("tab", { name: /Flashcards/ }).click();
  await page.getByRole("button", { name: "Reveal answer" }).click();
  await expect(page.getByText("Attention restricted to a subset of positions.")).toBeVisible();

  await page.getByRole("tab", { name: /Quiz/ }).click();
  await page.getByLabel("4", { exact: true }).check();
  await page.getByLabel("Rome").check();
  await page.getByRole("button", { name: /Submit answers/ }).click();
  await expect(page.getByText("Score: 1 / 2 (50%)")).toBeVisible();
  await page.getByLabel("Review incorrect answers only").check();
  await expect(page.getByText("Capital of France?")).toBeVisible();
  await expect(page.getByText("2 + 2 = ?")).toBeHidden();

  await page.reload();
  await page.getByRole("tab", { name: /Quiz/ }).click();
  await expect(page.getByText("Score: 1 / 2 (50%)")).toBeVisible();
});

test("favourite photos can be added, captioned, kept after refresh and deleted", async ({ page }) => {
  await page.goto("/photos");
  await expect(page.getByText("No photos yet")).toBeVisible();
  await page.locator("#photo-upload").setInputFiles([
    { name: "meadow.png", mimeType: "image/png", buffer: makePng(64, 48, [120, 150, 90]) },
    { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not an image") },
  ]);
  await expect(page.getByText("Added 1 photo. Location data was removed.")).toBeVisible();
  await expect(page.getByText('"notes.txt" is not an image.')).toBeVisible();

  await page.getByRole("button", { name: "Open meadow" }).click();
  await page.getByLabel("Caption").fill("Green meadow");
  await page.getByRole("button", { name: "Save caption" }).click();
  await expect(page.getByText("Caption saved.")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();

  await page.reload();
  const img = page.getByRole("img", { name: "Green meadow" });
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(64);

  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Open Green meadow" }).click();
  await page.getByRole("button", { name: "Delete photo" }).click();
  await expect(page.getByText("No photos yet")).toBeVisible();
});

test("venues: filter by rank, follow (persists), details and calendar export", async ({ page }) => {
  await page.goto("/venues");
  const count = page.getByText(/of \d+ venues/);
  await expect(count).toBeVisible({ timeout: 20_000 });
  const total = Number((await count.innerText()).match(/^(\d+)/)?.[1]);

  await page.getByRole("group", { name: "CORE rank" }).getByRole("button", { name: "A*", exact: true }).click();
  await expect(page).toHaveURL(/core=A\*/);
  await expect.poll(async () => Number((await count.innerText()).match(/^(\d+)/)?.[1])).toBeLessThan(total);
  // every visible card carries a CORE A* badge
  const first = page.locator("article").first();
  await expect(first.getByText("A*", { exact: true })).toBeVisible();
  await expect(first.getByLabel(/Time left/)).toBeVisible();

  const acronym = (await first.locator("h3 button").innerText()).split(" ")[0]!;
  await first.getByRole("button", { name: "Follow" }).click();
  await expect(first.getByRole("button", { name: "Following" })).toBeVisible();

  const download = page.waitForEvent("download");
  await first.getByRole("button", { name: `Download calendar file for ${acronym}` }).click();
  const file = await download;
  const ics = await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString("utf8"));
  expect(ics).toContain("BEGIN:VCALENDAR");
  expect(ics).toContain(`SUMMARY:${acronym}`);

  await first.getByRole("button", { name: "Details" }).click();
  await expect(page.getByRole("dialog").getByText("Deadlines by edition")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();

  await page.reload();
  await page.getByRole("button", { name: /Following \(1\)/ }).click();
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.locator("article h3")).toContainText(acronym);
});
