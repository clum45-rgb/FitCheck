import { describe, expect, it } from "vitest";
import { selectOwnedPhotoPaths } from "./style-photo-paths";

const userId = "3586c2f4-576a-481b-a3f2-032715a44a7c";
const ownPhoto = `${userId}/look.jpg`;
const otherPhoto = "1b47494c-908d-4e4d-894b-8b1846688265/look.jpg";

describe("style photo paths", () => {
  it("keeps only the signed-in user's files from the style-photos bucket", () => {
    expect(selectOwnedPhotoPaths(userId, [ownPhoto, otherPhoto], [ownPhoto, otherPhoto, `${userId}/missing.jpg`])).toEqual([
      ownPhoto,
    ]);
  });

  it("ignores a path that climbs out of the user's folder", () => {
    expect(selectOwnedPhotoPaths(userId, [otherPhoto], [`${userId}/../${otherPhoto}`])).toEqual([]);
  });
});
