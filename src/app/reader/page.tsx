import type { Metadata } from "next";
import { Suspense } from "react";
import { ReaderView } from "@/components/pdf/ReaderView";
import { Spinner } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "PDF Reader" };

export default function ReaderPage() {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <ReaderView />
    </Suspense>
  );
}
