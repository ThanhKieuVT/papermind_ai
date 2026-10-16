/** Research areas used by the CCF deadline dataset. */
export const AREAS = {
  AI: "Artificial Intelligence",
  CG: "Graphics & Multimedia",
  CT: "Theory",
  DB: "Databases & Data Mining",
  DS: "Architecture & Systems",
  HI: "HCI & Ubiquitous Computing",
  MX: "Interdisciplinary & Emerging",
  NW: "Networking",
  SC: "Security & Privacy",
  SE: "Software Engineering",
} as const;
export type AreaCode = keyof typeof AREAS;

export type CcfRank = "A" | "B" | "C";
export type CoreRank = "A*" | "A" | "B" | "C";

export interface DeadlineRound {
  /** UTC ISO timestamps; null when "TBD" or unparsable. */
  abstract: string | null;
  paper: string | null;
  rebuttal: string | null;
  notification: string | null;
  comment: string | null;
  /** True when the source says TBD for the paper deadline. */
  tba: boolean;
}

export interface Edition {
  year: number;
  link: string | null;
  dateText: string | null;
  place: string | null;
  /** Timezone exactly as published (e.g. "AoE", "UTC-7", "PT"). */
  timezone: string;
  /** False when the timezone could not be interpreted; times are then unreliable. */
  timezoneKnown: boolean;
  rounds: DeadlineRound[];
}

export interface AcceptRate {
  year: number;
  submitted: number | null;
  accepted: number | null;
  rate: number;
  source: string | null;
}

export interface Venue {
  /** Stable id, e.g. "AI/nips". */
  id: string;
  acronym: string;
  name: string;
  area: AreaCode;
  ranks: { ccf: CcfRank | null; core: CoreRank | null; thcpl: "A" | "B" | null };
  dblp: string | null;
  editions: Edition[];
  acceptRates: AcceptRate[];
}

export interface VenueDataset {
  source: string;
  license: string;
  commit: string | null;
  syncedAt: string;
  venues: Venue[];
}
