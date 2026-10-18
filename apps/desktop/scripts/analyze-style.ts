import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { styleAnalysisPrompt } from "../src/style-prompt.ts";
import { parseStyleProfile, styleProfileSchema } from "../src/style-profile.ts";
import { saveStyleProfile } from "./style-profile-rows.ts";
import { downloadStylePhotos, loadProjectEnv } from "./style-photos.ts";

const model = "gpt-5.4-mini";
const inputPricePerToken = 0.75 / 1_000_000;
const outputPricePerToken = 4.5 / 1_000_000;

loadProjectEnv(dirname(fileURLToPath(import.meta.url)));

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("Missing OPENAI_API_KEY. Add it to .env in the project root, then run this again.");
  process.exit(1);
}

const userId = process.argv[2];
if (!userId) {
  console.error("Pass a user id. Example: npm run analyze:style -w @fitcheck/desktop -- USER_ID");
  process.exit(1);
}

const images = await downloadStylePhotos(userId);
if (images.length === 0) {
  console.log("This user has no photos in style_photos. The model was not called.");
  process.exit(0);
}

const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: styleAnalysisPrompt },
          ...images.map((image) => ({
            type: "image_url",
            image_url: {
              url: `data:${image.mimeType};base64,${image.base64}`,
              detail: "high",
            },
          })),
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "style_profile",
        strict: true,
        schema: styleProfileSchema,
      },
    },
    max_completion_tokens: 800,
  }),
});

const body = (await response.json()) as {
  error?: { message?: string };
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

if (!response.ok) {
  console.error(body.error?.message ?? `OpenAI request failed (${response.status}).`);
  process.exit(1);
}

const content = body.choices?.[0]?.message?.content;
if (!content) {
  console.error("The model returned an empty answer.");
  process.exit(1);
}

let parsedJson: unknown;
try {
  parsedJson = JSON.parse(content);
} catch {
  console.error("The model did not return valid JSON.");
  process.exit(1);
}

const profile = parseStyleProfile(parsedJson);
if (!profile.ok) {
  console.error("The model answer failed the profile checklist:");
  for (const error of profile.errors) console.error(`- ${error}`);
  process.exit(1);
}

const inputTokens = body.usage?.prompt_tokens ?? 0;
const outputTokens = body.usage?.completion_tokens ?? 0;
const estimatedCost = inputTokens * inputPricePerToken + outputTokens * outputPricePerToken;

const saved = await saveStyleProfile(userId, profile.profile);

console.log(`Images: ${images.map((image) => image.name).join(", ")}`);
console.log(JSON.stringify(saved, null, 2));
console.log("Saved for this user. confirmed_at stays empty until the profile is confirmed.");
console.log(
  `Tokens: ${inputTokens} input, ${outputTokens} output. Estimated cost: $${estimatedCost.toFixed(4)}`,
);
