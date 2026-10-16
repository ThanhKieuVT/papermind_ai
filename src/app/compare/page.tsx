import type { Metadata } from "next";
import { CompareView } from "@/components/compare/CompareView";

export const metadata: Metadata = { title: "Compare Papers" };

export default function ComparePage() {
  return <CompareView />;
}
