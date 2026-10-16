import type { Metadata } from "next";
import { Suspense } from "react";
import { DiscoverView } from "@/components/papers/DiscoverView";
import { Spinner } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Discover Papers" };

export default function DiscoverPage() {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <DiscoverView />
    </Suspense>
  );
}
