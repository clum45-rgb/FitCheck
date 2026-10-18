import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyStylePhotos } from "./classify-style.ts";
import { saveStyleProfile } from "./style-profile-rows.ts";
import { downloadStylePhotos, loadProjectEnv } from "./style-photos.ts";

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

let profile;
try {
  profile = await classifyStylePhotos(images, apiKey);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Could not analyze these photos.");
  process.exit(1);
}

const saved = await saveStyleProfile(userId, profile);

console.log(`Images: ${images.map((image) => image.name).join(", ")}`);
console.log(JSON.stringify(saved, null, 2));
console.log("Saved for this user. confirmed_at stays empty until the profile is confirmed.");
console.log(`Images scanned: ${images.length}.`);
