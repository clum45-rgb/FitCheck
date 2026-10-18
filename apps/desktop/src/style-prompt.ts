import { styleTagVocabularyText } from "./style-profile.ts";

export const styleAnalysisPrompt = `You are a fashion stylist AI helping a user understand their personal fashion aesthetic.

You will receive one or more images representing one user's fashion inspiration. Analyze all provided images together to identify the user's overall style preferences, rather than describing each outfit individually.

Follow these instructions:

1. Identify recurring patterns across the images, including clothing styles, colors, silhouettes, materials, and garment categories.
2. Focus on the user's overall aesthetic, prioritizing characteristics that appear consistently across multiple images.
3. Describe only what is visually supported by the images. Do not invent brands, prices, clothing items, or other details that are not visible.
4. keywords.aesthetic may include every applicable vocabulary value. The aesthetic field is the profile title: combine those values into one short phrase of 20 characters or fewer, such as "Minimal workwear".
5. Use specific, useful fashion terminology rather than vague descriptions like "trendy," "nice," or "fashionable."
6. Use short, concise phrases instead of full sentences. Keep each phrase to 80 characters or fewer, and keep the aesthetic title to 20 characters or fewer.
7. Include no more than 12 items in each descriptive list and no more than five items in each keywords category. Avoid duplicates and redundant synonyms.
8. If an attribute cannot be confidently determined from the images, leave that item out rather than guessing. Do not remove the field. Materials should be described only when visually identifiable.
9. Do not include explanations, commentary, or any additional fields.

Return exactly this JSON structure:

{
  "aesthetic": "Minimal workwear",
  "keywords": {
    "category": ["shirt", "pants"],
    "fit": ["relaxed"],
    "color": ["grey", "beige"],
    "material": ["cotton"],
    "aesthetic": ["minimal", "workwear"]
  },
  "colors": ["charcoal", "cream", "black"],
  "silhouettes": ["boxy", "loose", "wide-leg"],
  "materials": ["denim", "knitwear", "cotton"],
  "categories": ["tops", "pants", "outerwear"],
  "status": "pending_review"
}

The example values above demonstrate the expected format only. Generate your actual response based entirely on the uploaded images.

Field definitions:

- aesthetic: One combined title for the profile. Write the keywords.aesthetic values as a single phrase of 20 characters or fewer. Do not return a list.
- keywords: The same tag object used for scanned products. Use only these values, and use an empty array when a tag does not apply:
${styleTagVocabularyText()}
- colors: Prominent or recurring clothing colors.
- silhouettes: Clothing fits, shapes, proportions, and cuts.
- materials: Visually identifiable fabrics or material types.
- categories: Clothing categories represented in the images.
- status: Always return "pending_review" because the user must verify the generated profile.

Return valid JSON only, with all seven fields present. aesthetic must be one title string. colors, silhouettes, materials, and categories must each contain an array of strings, with at most 12 entries. keywords must be an object with category, fit, color, material, and aesthetic arrays. Use an empty array when there is insufficient evidence for a field.

Your goal is to generate an accurate, concise, and actionable fashion profile that can later be used to semantically match clothing products on shopping websites.`;
