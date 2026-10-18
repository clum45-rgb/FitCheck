import { describe, expect, it, vi } from "vitest";
import { deleteOwnedPhoto, type PhotoDeletionRepository, type UserPhoto } from "./photoLibraryApi";

const photo: UserPhoto = {
  id: "photo-1",
  user_id: "user-1",
  storage_path: "user-1/photo.png",
  created_at: "2026-10-17T00:00:00.000Z",
};

function repository(overrides: Partial<PhotoDeletionRepository> = {}) {
  return {
    removeStorageObject: vi.fn(async () => {}),
    deleteMetadataRecord: vi.fn(async () => {}),
    ...overrides,
  } satisfies PhotoDeletionRepository;
}

describe("owned photo deletion", () => {
  it("removes the Storage object before deleting metadata", async () => {
    const calls: string[] = [];
    const repo = repository({
      removeStorageObject: vi.fn(async () => { calls.push("storage"); }),
      deleteMetadataRecord: vi.fn(async () => { calls.push("metadata"); }),
    });

    await deleteOwnedPhoto(repo, "user-1", photo);

    expect(calls).toEqual(["storage", "metadata"]);
  });

  it("keeps metadata when Storage deletion fails", async () => {
    const repo = repository({ removeStorageObject: vi.fn(async () => { throw new Error("storage denied"); }) });

    await expect(deleteOwnedPhoto(repo, "user-1", photo)).rejects.toThrow("storage denied");
    expect(repo.deleteMetadataRecord).not.toHaveBeenCalled();
  });

  it("rejects a photo owned by another user before any deletion", async () => {
    const repo = repository();

    await expect(deleteOwnedPhoto(repo, "user-2", photo)).rejects.toThrow("does not belong");
    expect(repo.removeStorageObject).not.toHaveBeenCalled();
    expect(repo.deleteMetadataRecord).not.toHaveBeenCalled();
  });
});