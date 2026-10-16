"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { deletePhoto, listPhotos, savePhoto, updateCaption, MAX_CAPTION_CHARS, type StoredPhoto } from "@/lib/storage/photos";
import { PhotoInputError, preparePhoto } from "@/lib/photos/process";
import { errorMessage } from "@/lib/api/client";
import { Alert, Button, EmptyState, PageHeader, Spinner, cx, inputClass, labelClass } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { IconUpload } from "@/components/ui/icons";
import { CatWithClover } from "@/components/ui/illustrations";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Object URLs for stored photos, revoked when photos change or the view unmounts. */
function usePhotoUrls(photos: StoredPhoto[]): Map<string, string> {
  const urls = useMemo(() => new Map(photos.map((p) => [p.id, URL.createObjectURL(new Blob([p.data], { type: p.type }))])), [photos]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return urls;
}

export function PhotosView() {
  const notify = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<StoredPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const urls = usePhotoUrls(photos);

  const reload = useCallback(async () => {
    try {
      setPhotos(await listPhotos());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;
    let added = 0;
    const failures: string[] = [];
    for (const [i, file] of files.entries()) {
      setUploading(`Adding photo ${i + 1} of ${files.length}…`);
      try {
        const prepared = await preparePhoto(file);
        await savePhoto({
          id: newId(),
          name: file.name.replace(/\.[^.]+$/, ""),
          type: "image/jpeg",
          ...prepared,
          caption: "",
          createdAt: new Date(Date.now() + i).toISOString(),
        });
        added++;
      } catch (e) {
        failures.push(e instanceof PhotoInputError ? e.message : `"${file.name}": ${errorMessage(e)}`);
      }
    }
    setUploading(null);
    await reload();
    if (added) notify(`Added ${added} photo${added > 1 ? "s" : ""}. Location data was removed.`);
    if (failures.length) setError(failures.join(" "));
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    void addFiles(files);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void addFiles(Array.from(e.dataTransfer.files));
  };

  const current = openIndex !== null ? photos[openIndex] : undefined;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <PageHeader
        title="Photos I Love"
        description="A little corner for your favourite moments. Photos are stored only in this browser — they're never uploaded, and location data is removed when you add them."
        actions={
          <>
            <input ref={input} type="file" accept="image/*,.heic,.heif" multiple className="sr-only" onChange={onPick} aria-label="Add photos" id="photo-upload" />
            <Button onClick={() => input.current?.click()} loading={uploading !== null}>
              <IconUpload size={16} /> Add photos
            </Button>
          </>
        }
      />

      {uploading && <Spinner label={uploading} />}
      {error && <Alert tone="error" className="mb-4" title="Some photos couldn't be added">{error}</Alert>}
      {loading && <Spinner label="Loading photos…" />}

      {!loading && photos.length === 0 && (
        <EmptyState
          title="No photos yet"
          illustration={<CatWithClover className="h-32 w-32" />}
          action={<Button onClick={() => input.current?.click()}><IconUpload size={16} /> Add your first photo</Button>}
        >
          Drag photos here or click the button. JPEG, PNG and WebP work everywhere; HEIC works in Safari.
        </EmptyState>
      )}

      {photos.length > 0 && (
        <ul
          className={cx(
            "columns-1 gap-4 rounded-2xl transition sm:columns-2 lg:columns-3 [&>li]:mb-4",
            dragging && "outline-dashed outline-2 outline-offset-8 outline-brand-400",
          )}
          aria-label="Your photos"
        >
          {photos.map((photo, i) => (
            <li key={photo.id} className="break-inside-avoid">
              <figure className="group overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900">
                <button type="button" onClick={() => setOpenIndex(i)} className="block w-full" aria-label={`Open ${photo.caption || photo.name}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL, nothing to optimize */}
                  <img
                    src={urls.get(photo.id)}
                    alt={photo.caption || photo.name}
                    width={photo.width}
                    height={photo.height}
                    className="h-auto w-full transition duration-300 group-hover:scale-[1.02]"
                  />
                </button>
                {photo.caption && <figcaption className="px-4 py-3 text-sm text-stone-600 dark:text-stone-300">{photo.caption}</figcaption>}
              </figure>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={current !== undefined} onClose={() => setOpenIndex(null)} title={current?.caption || current?.name || "Photo"} wide>
        {current && openIndex !== null && (
          <PhotoDetail
            key={current.id}
            photo={current}
            url={urls.get(current.id) ?? ""}
            position={`${openIndex + 1} / ${photos.length}`}
            onPrev={openIndex > 0 ? () => setOpenIndex(openIndex - 1) : undefined}
            onNext={openIndex < photos.length - 1 ? () => setOpenIndex(openIndex + 1) : undefined}
            onSaved={(updated) => setPhotos((all) => all.map((p) => (p.id === updated.id ? updated : p)))}
            onDeleted={async () => {
              await deletePhoto(current.id);
              setOpenIndex(null);
              notify("Photo deleted.", "info");
              await reload();
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function PhotoDetail({
  photo,
  url,
  position,
  onPrev,
  onNext,
  onSaved,
  onDeleted,
}: {
  photo: StoredPhoto;
  url: string;
  position: string;
  onPrev?: () => void;
  onNext?: () => void;
  onSaved: (photo: StoredPhoto) => void;
  onDeleted: () => void;
}) {
  const notify = useToast();
  const [caption, setCaption] = useState(photo.caption);

  return (
    <div className="space-y-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
      <img src={url} alt={photo.caption || photo.name} className="mx-auto max-h-[52vh] w-auto rounded-xl" />
      <div className="flex items-center justify-between">
        <Button variant="secondary" size="sm" onClick={onPrev} disabled={!onPrev}>← Previous</Button>
        <span className="text-sm text-stone-500">{position}</span>
        <Button variant="secondary" size="sm" onClick={onNext} disabled={!onNext}>Next →</Button>
      </div>
      <form
        className="space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            onSaved(await updateCaption(photo.id, caption));
            notify("Caption saved.");
          } catch (err) {
            notify(errorMessage(err), "error");
          }
        }}
      >
        <label htmlFor="photo-caption" className={labelClass}>Caption</label>
        <input id="photo-caption" className={inputClass} value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={MAX_CAPTION_CHARS} placeholder="Where was this? Why do you love it?" />
        <div className="flex justify-between gap-2">
          <Button
            variant="ghost"
            className="text-red-700 dark:text-red-300"
            onClick={() => {
              if (window.confirm("Delete this photo from your browser?")) onDeleted();
            }}
          >
            Delete photo
          </Button>
          <Button type="submit">Save caption</Button>
        </div>
      </form>
    </div>
  );
}
