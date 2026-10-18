export type StyleAnalysis = {
  aesthetic: string;
  keywords: string[];
  isMock: true;
};

export async function analyzeStylePhotos(storagePaths: string[]): Promise<StyleAnalysis> {
  if (storagePaths.length === 0) throw new Error("Upload inspiration photos before analysis.");

  await new Promise((resolve) => window.setTimeout(resolve, 650));
  return {
    aesthetic: "Relaxed modern",
    keywords: ["Clean lines", "Relaxed tailoring", "Neutral palette", "Everyday layers"],
    isMock: true,
  };
}