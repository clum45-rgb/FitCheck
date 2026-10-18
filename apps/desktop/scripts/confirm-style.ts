import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { confirmStyleProfile } from "./style-profile-rows.ts";
import { loadProjectEnv } from "./style-photos.ts";

loadProjectEnv(dirname(fileURLToPath(import.meta.url)));

const userId = process.argv[2];
if (!userId) {
  console.error("Pass a user id. Example: npm run confirm:style -w @fitcheck/desktop -- USER_ID");
  process.exit(1);
}

try {
  const saved = await confirmStyleProfile(userId);
  if (!saved) {
    console.log("This user has no profile waiting to be confirmed.");
    process.exit(0);
  }
  console.log(JSON.stringify(saved, null, 2));
  console.log("Confirmed. confirmed_at is now set.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Could not confirm the profile.");
  process.exit(1);
}
