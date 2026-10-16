import type { Metadata } from "next";
import { Suspense } from "react";
import { VenuesView } from "@/components/venues/VenuesView";
import { Spinner } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Venues & Deadlines" };

export default function VenuesPage() {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <VenuesView />
    </Suspense>
  );
}
