import { describe, expect, it, vi } from "vitest";
import { uploadPhotoFiles, type PhotoUploadRepository } from "./photoStorage";

const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

function makePhotos(count: number) {
  return Array.from({ length: count }, (_, index) => new File([pngBytes], `look-${index}.png`, { type: "image/png" }));
}

function makeRepository(overrides: Partial<PhotoUploadRepository> = {}) {
  return {
    getPhotoCount: vi.fn(async () => 0),
    uploadObject: vi.fn(async () => {}),
    insertPhotoRecord: vi.fn(async () => {}),
    removePhotoRecord: vi.fn(async () => {}),
    removeObject: vi.fn(async () => {}),
    ...overrides,
  } satisfies PhotoUploadRepository;
}

describe("per-file photo uploads", () => {
  it("allows only two more photos when seven are already saved", async () => {
    let count = 7;
    const repository = makeRepository({
      getPhotoCount: vi.fn(async () => count),
      insertPhotoRecord: vi.fn(async () => { count += 1; }),
    });

    const result = await uploadPhotoFiles(repository, "user-123", makePhotos(5));

    expect(result.saved).toHaveLength(2);
    expect(result.failed).toHaveLength(3);
    expect(result.failed[0].message).toContain("collection is full");
    expect(repository.getPhotoCount).toHaveBeenCalledTimes(3);
    expect(result.saved.every(({ storagePath }) => storagePath.startsWith("user-123/"))).toBe(true);
  });

  it("does not upload when the persisted collection already has nine photos", async () => {
    const repository = makeRepository({ getPhotoCount: vi.fn(async () => 9) });

    const result = await uploadPhotoFiles(repository, "user-123", makePhotos(1));

    expect(result.saved).toHaveLength(0);
    expect(result.failed[0].message).toContain("collection is full");
    expect(repository.uploadObject).not.toHaveBeenCalled();
  });

  it("allows one photo at eight saved and records the exact owner and uploaded path", async () => {
    let count = 8;
    const uploadedPaths: string[] = [];
    const repository = makeRepository({
      getPhotoCount: vi.fn(async () => count),
      uploadObject: vi.fn(async (storagePath) => { uploadedPaths.push(storagePath); }),
      insertPhotoRecord: vi.fn(async () => { count += 1; }),
    });

    const result = await uploadPhotoFiles(repository, "user-123", makePhotos(2));

    expect(result.saved).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
    expect(repository.insertPhotoRecord).toHaveBeenCalledWith("user-123", uploadedPaths[0]);
    expect(result.saved[0].storagePath).toBe(uploadedPaths[0]);
  });

  it("cleans up an uploaded object when its metadata record fails, then reports later files", async () => {
    const repository = makeRepository({
      insertPhotoRecord: vi.fn()
        .mockRejectedValueOnce(new Error("metadata unavailable"))
        .mockResolvedValueOnce(undefined),
    });

    const result = await uploadPhotoFiles(repository, "user-123", makePhotos(2));

    expect(result.saved).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].message).toContain("metadata unavailable");
    expect(repository.removePhotoRecord).toHaveBeenCalledTimes(1);
    expect(repository.removeObject).toHaveBeenCalledTimes(1);
    expect(repository.uploadObject).toHaveBeenCalledTimes(2);
  });

  it("blocks remaining uploads if the saved count cannot be retrieved", async () => {
    const repository = makeRepository({ getPhotoCount: vi.fn().mockRejectedValue(new Error("network unavailable")) });

    const result = await uploadPhotoFiles(repository, "user-123", makePhotos(2));

    expect(result.saved).toHaveLength(0);
    expect(result.failed).toHaveLength(2);
    expect(repository.uploadObject).not.toHaveBeenCalled();
  });
});