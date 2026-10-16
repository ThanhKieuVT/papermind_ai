/**
 * Downloads ccfddl/ccf-deadlines (MIT License) and writes a normalized snapshot to
 * public/data/venues.json. Run with Node >= 22.18:  npm run sync:venues
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { normalizeConference } from "../src/lib/venues/normalize.ts";
import type { Venue, VenueDataset } from "../src/lib/venues/types.ts";

const REPO = "ccfddl/ccf-deadlines";
const OUT = join(import.meta.dirname, "..", "public", "data", "venues.json");
const KEEP_YEARS = 5;

async function latestCommit(): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) return null;
    return ((await res.json()) as { sha?: string }).sha ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const commit = await latestCommit();
  const ref = commit ?? "main";
  const res = await fetch(`https://codeload.github.com/${REPO}/tar.gz/${ref}`);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const dir = mkdtempSync(join(tmpdir(), "ccfddl-"));
  try {
    const tarPath = join(dir, "repo.tar.gz");
    writeFileSync(tarPath, Buffer.from(await res.arrayBuffer()));
    execFileSync("tar", ["-xzf", tarPath, "-C", dir]);
    const root = readdirSync(dir).map((d) => join(dir, d)).find((p) => existsSync(join(p, "conference")));
    if (!root) throw new Error("Unexpected archive layout");

    const minYear = new Date().getUTCFullYear() - KEEP_YEARS;
    const venues: Venue[] = [];
    let skipped = 0;
    for (const area of readdirSync(join(root, "conference"))) {
      const areaDir = join(root, "conference", area);
      if (!existsSync(areaDir) || area.endsWith(".yml")) continue;
      for (const file of readdirSync(areaDir).filter((f) => f.endsWith(".yml"))) {
        const records = parse(readFileSync(join(areaDir, file), "utf8")) as unknown;
        const ratePath = join(root, "accept_rates", area, file);
        const rateRecords = existsSync(ratePath) ? (parse(readFileSync(ratePath, "utf8")) as unknown) : null;
        for (const raw of Array.isArray(records) ? records : []) {
          const rates = Array.isArray(rateRecords) ? (rateRecords.find((r) => r?.title === raw?.title) ?? null) : null;
          const venue = normalizeConference(raw, `${area}/${file.replace(/\.yml$/, "")}`, rates, minYear);
          if (venue) venues.push(venue);
          else skipped++;
        }
      }
    }
    venues.sort((a, b) => a.acronym.localeCompare(b.acronym));
    // Only rewrite the snapshot when the venue data actually changed, so scheduled runs
    // don't create commits that just bump the timestamp.
    if (existsSync(OUT)) {
      const previous = JSON.parse(readFileSync(OUT, "utf8")) as VenueDataset;
      if (JSON.stringify(previous.venues) === JSON.stringify(venues)) {
        console.log(`[sync-venues] no changes (${venues.length} venues, last updated ${previous.syncedAt})`);
        return;
      }
    }
    const dataset: VenueDataset = {
      source: `https://github.com/${REPO}`,
      license: "MIT (Copyright (c) 2021 CCFDDL)",
      commit,
      syncedAt: new Date().toISOString(),
      venues,
    };
    writeFileSync(OUT, JSON.stringify(dataset));
    const unknownTz = venues.flatMap((v) => v.editions).filter((e) => !e.timezoneKnown).length;
    console.log(`[sync-venues] ${venues.length} venues (skipped ${skipped}, unknown timezones ${unknownTz}) -> ${OUT}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error("[sync-venues] failed:", e);
  process.exit(1);
});
