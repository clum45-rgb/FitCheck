export const MAX_PHOTO_COUNT = 9;
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

const imageFormats = {
  "image/jpeg": { extension: "jpg", matches: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: "png", matches: (bytes: Uint8Array) => bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10" },
  "image/webp": { extension: "webp", matches: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" },
} as const;

export type SupportedImageType = keyof typeof imageFormats;

export async function detectImageType(file: File): Promise<SupportedImageType | null> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const matchingType = (Object.keys(imageFormats) as SupportedImageType[])
    .find((type) => imageFormats[type].matches(bytes));

  if (!matchingType) return null;
  if (file.type && file.type !== matchingType) return null;
  return matchingType;
}

export function fileExtensionForType(type: SupportedImageType) {
  return imageFormats[type].extension;
}

export type PhotoValidationResult = {
  validFiles: File[];
  errors: string[];
};

export async function validatePhotoFiles(files: File[], existingCount = 0): Promise<PhotoValidationResult> {
  const validFiles: File[] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (existingCount + validFiles.length >= MAX_PHOTO_COUNT) {
      errors.push(`You can select up to ${MAX_PHOTO_COUNT} photos.`);
      break;
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      errors.push(`${file.name} is over the 5 MB limit.`);
      continue;
    }

    if (!await detectImageType(file)) {
      errors.push(`${file.name} is not a supported JPEG, PNG, or WebP image.`);
      continue;
    }

    validFiles.push(file);
  }

  return { validFiles, errors };
}