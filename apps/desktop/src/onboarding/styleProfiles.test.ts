import { describe, expect, it, vi } from "vitest";
import { aestheticTitle, coerceStyleTags, emptyStyleTags, type StyleTags } from "../style-profile";
import { normalizeStyleProfile, persistConfirmedStyleProfile, persistEditedStyleProfile, type StyleProfileRepository } from "./styleProfiles";

function repository(overrides: Partial<StyleProfileRepository> = {}) {
  return {
    saveStyleProfile: vi.fn(async () => {}),
    markOnboardingComplete: vi.fn(async () => {}),
    ...overrides,
  } satisfies StyleProfileRepository;
}

function tags(partial: Partial<StyleTags> = {}): StyleTags {
  return { ...emptyStyleTags(), ...partial };
}

describe("confirmed style profile persistence", () => {
  it("turns a saved aesthetic list into one title", () => {
    expect(aestheticTitle(["minimalist streetwear", "androgynous tailoring"])).toBe("minimalist streetwear androgynous tailoring");
  });

  it("trims the aesthetic and keeps only product-tag vocabulary", () => {
    expect(normalizeStyleProfile("  Modern  ", {
      category: [" shirt ", "shirt", "not-a-category"],
      fit: [],
      color: ["Navy"],
      material: [],
      aesthetic: [],
    })).toEqual({
      aesthetic: "Modern",
      keywords: tags({ category: ["shirt"], color: ["navy"] }),
    });
  });

  it("saves the style profile before marking onboarding complete", async () => {
    const calls: string[] = [];
    const repo = repository({
      saveStyleProfile: vi.fn(async () => { calls.push("style"); }),
      markOnboardingComplete: vi.fn(async () => { calls.push("complete"); }),
    });

    await persistConfirmedStyleProfile(repo, " Modern ", tags({ fit: ["relaxed"] }));

    expect(calls).toEqual(["style", "complete"]);
    expect(repo.saveStyleProfile).toHaveBeenCalledWith("Modern", tags({ fit: ["relaxed"] }));
  });

  it("does not mark onboarding complete if the style-profile write fails", async () => {
    const repo = repository({ saveStyleProfile: vi.fn(async () => { throw new Error("write failed"); }) });

    await expect(persistConfirmedStyleProfile(repo, "Modern", tags({ fit: ["relaxed"] }))).rejects.toThrow("write failed");
    expect(repo.markOnboardingComplete).not.toHaveBeenCalled();
  });

  it("keeps a saved profile retryable if completion status fails", async () => {
    const repo = repository({ markOnboardingComplete: vi.fn(async () => { throw new Error("update failed"); }) });

    await expect(persistConfirmedStyleProfile(repo, "Modern", tags({ fit: ["relaxed"] })))
      .rejects.toThrow("Your style profile was saved, but onboarding could not be completed");
    expect(repo.saveStyleProfile).toHaveBeenCalledTimes(1);
    expect(repo.markOnboardingComplete).toHaveBeenCalledTimes(1);
  });

  it("rejects an empty aesthetic or tag set before writing", async () => {
    const repo = repository();

    await expect(persistConfirmedStyleProfile(repo, " ", tags({ fit: ["relaxed"] }))).rejects.toThrow("aesthetic label");
    await expect(persistConfirmedStyleProfile(repo, "Modern", emptyStyleTags())).rejects.toThrow("at least one");
    expect(repo.saveStyleProfile).not.toHaveBeenCalled();
  });

  it("saves profile edits without rerunning onboarding completion", async () => {
    const repo = repository();

    await persistEditedStyleProfile(repo, "Modern", tags({ material: ["cotton"] }));

    expect(repo.saveStyleProfile).toHaveBeenCalledWith("Modern", tags({ material: ["cotton"] }));
    expect(repo.markOnboardingComplete).not.toHaveBeenCalled();
  });

  it("rejects phrases that are not product tags", () => {
    expect(() => normalizeStyleProfile("Modern", ["Clean lines", "Relaxed tailoring"])).toThrow("at least one");
  });

  it("keeps only vocabulary values when reading a saved tag object", () => {
    expect(coerceStyleTags(["Clean lines", "Relaxed tailoring"])).toEqual(emptyStyleTags());
    expect(coerceStyleTags({
      category: ["accessory"],
      fit: ["relaxed tailoring"],
      color: ["navy"],
      material: ["cotton"],
      aesthetic: [],
    })).toEqual(tags({ category: ["accessory"], color: ["navy"], material: ["cotton"] }));
  });
});
