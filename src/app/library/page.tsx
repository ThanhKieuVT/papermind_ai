import type { Metadata } from "next";
import { LibraryView } from "@/components/papers/LibraryView";

export const metadata: Metadata = { title: "My Library" };

export default function LibraryPage() {
  return <LibraryView />;
}
