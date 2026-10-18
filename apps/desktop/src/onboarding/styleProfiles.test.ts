import { describe, expect, it, vi } from "vitest";
import { normalizeStyleProfile, persistConfirmedStyleProfile, persistEditedStyleProfile, readConfirmedStyleProfile, type StyleProfileRepository } from "./styleProfiles";

function repository(overrides: Partial<StyleProfileRepository> = {}) {
  return {
    saveStyleProfile: vi.fn(async () => {}),
    markOnboardingComplete: vi.fn(async () => {}),
    ...overrides,
  } satisfies StyleProfileRepository;
}

describe("confirmed style profile persistence", () => {
  it("turns a saved aesthetic list into one phrase for the form", () => {
    expect(readConfirmedStyleProfile({
      aesthetic: ["minimalist streetwear", "androgynous tailoring"],
      keywords: ["relaxed fit", "clean lines"],
      confirmed_at: "2026-10-18T02:10:31.107+00:00",
    })).toEqual({
      aesthetic: "minimalist streetwear, androgynous tailoring",
      keywords: ["relaxed fit", "clean lines"],
      confirmed_at: "2026-10-18T02:10:31.107+00:00",
    });
  });

  it("trims the aesthetic and removes blank or duplicate keywords", () => {
    expect(normalizeStyleProfile("  Modern  ", ["Clean lines", "", "Clean lines", "Layered"])).toEqual({
      aesthetic: "Modern",
      keywords: ["Clean lines", "Layered"],
    });
  });

  it("saves the style profile before marking onboarding complete", async () => {
    const calls: string[] = [];
    const repo = repository({
      saveStyleProfile: vi.fn(async () => { calls.push("style"); }),
      markOnboardingComplete: vi.fn(async () => { calls.push("complete"); }),
    });

    await persistConfirmedStyleProfile(repo, " Modern ", [" Layered "]);

    expect(calls).toEqual(["style", "complete"]);
    expect(repo.saveStyleProfile).toHaveBeenCalledWith("Modern", ["Layered"]);
  });

  it("does not mark onboarding complete if the style-profile write fails", async () => {
    const repo = repository({ saveStyleProfile: vi.fn(async () => { throw new Error("write failed"); }) });

    await expect(persistConfirmedStyleProfile(repo, "Modern", ["Layered"])).rejects.toThrow("write failed");
    expect(repo.markOnboardingComplete).not.toHaveBeenCalled();
  });

  it("keeps a saved profile retryable if completion status fails", async () => {
    const repo = repository({ markOnboardingComplete: vi.fn(async () => { throw new Error("update failed"); }) });

    await expect(persistConfirmedStyleProfile(repo, "Modern", ["Layered"]))
      .rejects.toThrow("Your style profile was saved, but onboarding could not be completed");
    expect(repo.saveStyleProfile).toHaveBeenCalledTimes(1);
    expect(repo.markOnboardingComplete).toHaveBeenCalledTimes(1);
  });

  it("rejects an empty aesthetic or keyword list before writing", async () => {
    const repo = repository();

    await expect(persistConfirmedStyleProfile(repo, " ", ["Layered"])).rejects.toThrow("aesthetic label");
    await expect(persistConfirmedStyleProfile(repo, "Modern", [" "])).rejects.toThrow("at least one");
    expect(repo.saveStyleProfile).not.toHaveBeenCalled();
  });

  it("saves profile edits without rerunning onboarding completion", async () => {
    const repo = repository();

    await persistEditedStyleProfile(repo, "Modern", ["Layered"]);

    expect(repo.saveStyleProfile).toHaveBeenCalledWith("Modern", ["Layered"]);
    expect(repo.markOnboardingComplete).not.toHaveBeenCalled();
  });
});