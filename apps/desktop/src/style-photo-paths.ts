const bucketMarker = "/style-photos/";

export function normalizeStylePhotoPath(storagePath: string) {
  const markerIndex = storagePath.indexOf(bucketMarker);
  const path = markerIndex === -1 ? storagePath : storagePath.slice(markerIndex + bucketMarker.length);
  return path.replace(/^style-photos\//, "").replace(/^\/+/, "");
}

export function selectOwnedPhotoPaths(userId: string, storedPaths: string[], requestedPaths: string[]) {
  const requested = new Set(
    requestedPaths
      .map(normalizeStylePhotoPath)
      .filter((path) => path.startsWith(`${userId}/`) && !path.split("/").includes("..")),
  );
  const selected: string[] = [];

  for (const stored of storedPaths) {
    const path = normalizeStylePhotoPath(stored);
    if (!requested.has(path) || selected.includes(path)) continue;
    selected.push(path);
  }

  return selected;
}
