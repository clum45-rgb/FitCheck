import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { listStylePhotoPaths, loadProjectEnv } from "./style-photos.ts";

loadProjectEnv(dirname(fileURLToPath(import.meta.url)));

const userId = process.argv[2];
if (!userId) {
  console.error("Pass a user id. Example: npm run list:style-photos -w @fitcheck/desktop -- USER_ID");
  process.exit(1);
}

try {
  const paths = await listStylePhotoPaths(userId);
  if (paths.length === 0) {
    console.log("This user has no photos in style_photos.");
  } else {
    for (const path of paths) console.log(path);
    console.log(`${paths.length} file${paths.length === 1 ? "" : "s"}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Could not list style-photos.");
  process.exit(1);
}
