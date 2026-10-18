import { type StyleTags } from "../style-profile";

export type StyleAnalysis = {
  aesthetic: string;
  keywords: StyleTags;
  isMock: true;
};

export async function analyzeStylePhotos(storagePaths: string[]): Promise<StyleAnalysis> {
  if (storagePaths.length === 0) throw new Error("Upload inspiration photos before analysis.");

  await new Promise((resolve) => window.setTimeout(resolve, 650));
  return {
    aesthetic: "Relaxed modern",
    keywords: {
      category: ["shirt", "pants"],
      fit: ["relaxed"],
      color: ["grey", "beige", "white"],
      material: ["cotton"],
      aesthetic: ["minimal", "casual"],
    },
    isMock: true,
  };
}