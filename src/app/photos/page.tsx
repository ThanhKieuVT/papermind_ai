import type { Metadata } from "next";
import { PhotosView } from "@/components/photos/PhotosView";

export const metadata: Metadata = { title: "Photos I Love" };

export default function PhotosPage() {
  return <PhotosView />;
}
