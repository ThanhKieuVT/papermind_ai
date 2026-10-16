/** Client-side photo preparation for the personal gallery. */

export const MAX_INPUT_BYTES = 40 * 1024 * 1024;
export const MAX_SIDE = 2000;
const JPEG_QUALITY = 0.85;

export class PhotoInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoInputError";
  }
}

/** Scales (width, height) down to fit within `max` on the longest side; never upscales. */
export function fitWithin(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  if (width <= 0 || height <= 0) throw new PhotoInputError("The image has no size.");
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function validatePhotoFile(file: { name: string; type: string; size: number }): void {
  const isHeic = /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type);
  if (!file.type.startsWith("image/") && !isHeic) throw new PhotoInputError(`"${file.name}" is not an image.`);
  if (file.size === 0) throw new PhotoInputError(`"${file.name}" is empty.`);
  if (file.size > MAX_INPUT_BYTES) throw new PhotoInputError(`"${file.name}" is larger than ${MAX_INPUT_BYTES / 1024 / 1024} MB.`);
}

/**
 * Decodes the image (respecting its EXIF orientation), downsizes it and re-encodes it as JPEG.
 * Re-encoding through a canvas drops all metadata, including GPS location.
 */
export async function preparePhoto(file: File): Promise<{ data: ArrayBuffer; width: number; height: number }> {
  validatePhotoFile(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoInputError(
      /\.(heic|heif)$/i.test(file.name)
        ? `"${file.name}" is a HEIC photo, which this browser can't open. Export it as JPEG first (or use Safari).`
        : `"${file.name}" could not be read as an image.`,
    );
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PhotoInputError("Your browser could not process this image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob) throw new PhotoInputError("Your browser could not process this image.");
  return { data: await blob.arrayBuffer(), width, height };
}
