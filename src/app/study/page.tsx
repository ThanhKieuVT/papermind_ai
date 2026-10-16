import type { Metadata } from "next";
import { Suspense } from "react";
import { StudyView } from "@/components/study/StudyView";
import { Spinner } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Study Center" };

export default function StudyPage() {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <StudyView />
    </Suspense>
  );
}
