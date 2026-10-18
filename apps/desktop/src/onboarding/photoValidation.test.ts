import { describe, expect, it } from "vitest";
import { MAX_PHOTO_COUNT, MAX_PHOTO_SIZE_BYTES, detectImageType, validatePhotoFiles } from "./photoValidation";

function photo(bytes: number[], name: string, type: string) {
  return new File([new Uint8Array(bytes).buffer], name, { type });
}

const validPngBytes = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0];

describe("inspiration photo validation", () => {
  it("accepts supported image signatures and rejects a spoofed MIME type", async () => {
    const jpeg = photo([0xff, 0xd8, 0xff, 0x00], "look.jpg", "image/jpeg");
    const png = photo(validPngBytes, "moodboard.png", "image/png");
    const webp = photo([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80], "detail.webp", "image/webp");
    const spoof = photo(validPngBytes, "not-really.jpg", "image/jpeg");

    expect(await detectImageType(jpeg)).toBe("image/jpeg");
    expect(await detectImageType(png)).toBe("image/png");
    expect(await detectImageType(webp)).toBe("image/webp");
    expect(await detectImageType(spoof)).toBeNull();
  });

  it("rejects oversized files and stops at the ten-photo limit", async () => {
    const oversized = new File([new Uint8Array(MAX_PHOTO_SIZE_BYTES + 1).buffer], "large.png", { type: "image/png" });
    const tenPhotos = Array.from({ length: MAX_PHOTO_COUNT + 1 }, (_, index) => photo(validPngBytes, `${index}.png`, "image/png"));

    const sizeResult = await validatePhotoFiles([oversized]);
    const countResult = await validatePhotoFiles(tenPhotos);

    expect(sizeResult.validFiles).toHaveLength(0);
    expect(sizeResult.errors[0]).toContain("5 MB");
    expect(countResult.validFiles).toHaveLength(MAX_PHOTO_COUNT);
    expect(countResult.errors[0]).toContain("up to 10");

    const sevenSavedResult = await validatePhotoFiles(tenPhotos, 7);
    const nineSavedResult = await validatePhotoFiles(tenPhotos, 9);
    expect(sevenSavedResult.validFiles).toHaveLength(3);
    expect(nineSavedResult.validFiles).toHaveLength(1);
  });
});