import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { MAX_PHOTO_COUNT, validatePhotoFiles } from "./photoValidation";
import { uploadInspirationPhotos, type PhotoUploadProgress } from "./photoStorage";
import { analyzeStylePhotos, type StyleAnalysis } from "./styleAnalysis";
import { StyleTagList } from "./StyleTagList";
import { getConfirmedStyleProfile, saveConfirmedStyleProfile } from "./styleProfiles";
import { getUserPhotoMetadata } from "./photoLibraryApi";
import { emptyStyleTags, styleTagCount, withoutStyleTag, type StyleTagField, type StyleTags } from "../style-profile";

type SelectedPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

type OnboardingFlowProps = {
  isReplacement: boolean;
  onConfirmed: () => Promise<void>;
};

export function OnboardingFlow({ isReplacement, onConfirmed }: OnboardingFlowProps) {
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [storagePaths, setStoragePaths] = useState<string[]>([]);
  const [existingPhotoPaths, setExistingPhotoPaths] = useState<string[]>([]);
  const [savedPhotoCount, setSavedPhotoCount] = useState(0);
  const [savedCountLoaded, setSavedCountLoaded] = useState(false);
  const [analysis, setAnalysis] = useState<StyleAnalysis | null>(null);
  const [aesthetic, setAesthetic] = useState("");
  const [keywords, setKeywords] = useState<StyleTags>(emptyStyleTags);
  const [phase, setPhase] = useState<"loading-profile" | "ready" | "validating" | "uploading" | "analyzing" | "review" | "saving" | "error">("loading-profile");
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<PhotoUploadProgress | null>(null);
  const [recoveredProfile, setRecoveredProfile] = useState(false);
  const previewUrls = useRef(new Set<string>());
  const submitLock = useRef(false);

  const busy = phase === "loading-profile" || phase === "validating" || phase === "uploading" || phase === "analyzing" || phase === "saving";

  useEffect(() => {
    let active = true;
    async function loadSavedState() {
      setPhase("loading-profile");
      setError(null);
      try {
        const [photoRows, savedProfile] = await Promise.all([
          getUserPhotoMetadata(),
          isReplacement ? Promise.resolve(null) : getConfirmedStyleProfile(),
        ]);
        if (!active) return;
        setExistingPhotoPaths(photoRows.map(({ storage_path }) => storage_path));
        setSavedPhotoCount(photoRows.length);
        setSavedCountLoaded(true);
        if (savedProfile) {
          setAesthetic(savedProfile.aesthetic);
          setKeywords(savedProfile.keywords);
          setRecoveredProfile(true);
          setPhase("review");
        } else {
          setPhase("ready");
        }
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? `Could not check your saved photos: ${loadError.message}` : "Could not check your saved photos.");
        setPhase("error");
      }
    }
    void loadSavedState();
    return () => { active = false; };
  }, [isReplacement]);

  useEffect(() => () => {
    previewUrls.current.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
    previewUrls.current.clear();
  }, []);

  async function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const pickedFiles = Array.from(input.files ?? []);
    input.value = "";
    if (pickedFiles.length === 0) return;

    setPhase("validating");
    setError(null);
    const result = await validatePhotoFiles(pickedFiles, savedPhotoCount + photos.length);
    if (result.validFiles.length > 0) {
      setPhotos((current) => [...current, ...result.validFiles.map((file) => {
        const previewUrl = URL.createObjectURL(file);
        previewUrls.current.add(previewUrl);
        return { id: crypto.randomUUID(), file, previewUrl };
      })]);
    }
    setError(result.errors.length > 0 ? result.errors.join(" ") : null);
    setPhase("ready");
  }

  function removePhoto(photoId: string) {
    setPhotos((current) => {
      const photo = current.find(({ id }) => id === photoId);
      if (photo) {
        URL.revokeObjectURL(photo.previewUrl);
        previewUrls.current.delete(photo.previewUrl);
      }
      return current.filter(({ id }) => id !== photoId);
    });
  }

  async function startAnalysis() {
    if (submitLock.current) return;
    submitLock.current = true;
    setError(null);
    setUploadProgress(null);
    try {
      let paths = storagePaths;
      if (photos.length > 0 && paths.length === 0) {
        setPhase("uploading");
        const uploadResult = await uploadInspirationPhotos(photos.map(({ file }) => file), setUploadProgress);
        paths = uploadResult.saved.map(({ storagePath }) => storagePath);
        const failedIndexes = new Set(uploadResult.failed.map(({ fileIndex }) => fileIndex));
        setPhotos((current) => current.filter((_, index) => failedIndexes.has(index)));
        setStoragePaths(paths);
        setSavedPhotoCount((count) => count + paths.length);
        if (uploadResult.failed.length > 0) {
          const savedCount = uploadResult.saved.length;
          setError(`${savedCount} photo${savedCount === 1 ? " was" : "s were"} saved. ${uploadResult.failed.map(({ fileName, message }) => `${fileName}: ${message}`).join(" ")}`);
        }
        if (paths.length === 0) {
          throw new Error(uploadResult.failed.map(({ message }) => message).join(" ") || "No photos were saved.");
        }
        setExistingPhotoPaths((current) => [...current, ...paths]);
        try {
          const persistedRows = await getUserPhotoMetadata();
          setSavedPhotoCount(persistedRows.length);
          setExistingPhotoPaths(persistedRows.map(({ storage_path }) => storage_path));
        } catch {
          setError("Your photos were saved, but the collection count could not refresh. Refresh the page before adding more.");
        }
      }
      if (paths.length === 0) paths = existingPhotoPaths;
      if (paths.length === 0) throw new Error("Add at least one inspiration photo before continuing.");
      setPhase("analyzing");
      const result = await analyzeStylePhotos(paths);
      setAnalysis(result);
      setAesthetic(result.aesthetic);
      setKeywords(result.keywords);
      setPhase("review");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not analyze these photos.");
      setPhase("error");
    } finally {
      submitLock.current = false;
    }
  }

  function replacePhotos() {
    if (!window.confirm("Replace this photo set and its unconfirmed suggestions? Your saved style profile will not change.")) return;
    photos.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
    setPhotos([]);
    setStoragePaths([]);
    setAnalysis(null);
    setAesthetic("");
    setKeywords(emptyStyleTags());
    setError(null);
    setPhase("ready");
    setRecoveredProfile(false);
  }

  function removeTag(field: StyleTagField, value: string) {
    setKeywords((current) => withoutStyleTag(current, field, value));
  }

  async function confirmStyle() {
    setError(null);
    setPhase("saving");
    try {
      await saveConfirmedStyleProfile(aesthetic, keywords);
      await onConfirmed();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your style profile. Try again.");
      setPhase("review");
    }
  }

  return (
    <main className="progress-screen onboarding-screen">
      <header className="app-header">
        <div className="wordmark"><span className="wordmark-mark">F</span> FITCHECK</div>
        <span className="app-header-label">YOUR STYLE, IN FOCUS</span>
      </header>

      {phase !== "review" && phase !== "saving" ? (
        <section className="onboarding-content">
          <div className="flow-heading">
            <p className="eyebrow">Step 01 / 02 · Inspiration</p>
            <h1>Show us what feels like you.</h1>
            <p>Choose up to 10 images. A moodboard, a saved look, a detail you keep coming back to: it all counts.</p>
          </div>

          <div className="upload-toolbar">
            <span className="photo-count">{savedCountLoaded ? savedPhotoCount + photos.length : "—"}<span> / {MAX_PHOTO_COUNT} photos</span></span>
            {savedCountLoaded && savedPhotoCount + photos.length < MAX_PHOTO_COUNT && <label className="secondary-button" htmlFor="photo-input">Add inspiration <span aria-hidden="true">+</span></label>}
            <input id="photo-input" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!savedCountLoaded || busy || savedPhotoCount + photos.length >= MAX_PHOTO_COUNT} onChange={(event) => void addFiles(event)} />
          </div>

          {savedCountLoaded && savedPhotoCount + photos.length >= MAX_PHOTO_COUNT && <p className="limit-message" role="status">Your photo collection is full. Remove a photo from My Style Profile to add another.</p>}
          {photos.length === 0 && existingPhotoPaths.length === 0 ? (
            <label className="drop-zone" htmlFor="photo-input">
              <span className="drop-mark" aria-hidden="true">+</span>
              <strong>Choose inspiration photos</strong>
              <span>JPEG, PNG or WebP · up to 5 MB each</span>
            </label>
          ) : photos.length > 0 ? (
            <div className="photo-grid" aria-label="Selected inspiration photos">
              {photos.map((photo, index) => (
                <figure className="photo-tile" key={photo.id}>
                  <img src={photo.previewUrl} alt={`Inspiration photo ${index + 1}: ${photo.file.name}`} />
                  <button type="button" className="remove-photo" aria-label={`Remove ${photo.file.name}`} onClick={() => removePhoto(photo.id)} disabled={busy}>×</button>
                </figure>
              ))}
              {photos.length < MAX_PHOTO_COUNT && <label className="add-photo-tile" htmlFor="photo-input">+<span>Add more</span></label>}
            </div>
          ) : <p className="library-empty">Your saved inspiration photos are ready to use for a style suggestion.</p>}

          {error && <p className="flow-error" role="alert">{error}</p>}
          {phase === "uploading" && <p className="flow-status" role="status">Uploading {uploadProgress?.complete ?? 0} of {uploadProgress?.total ?? photos.length}: {uploadProgress?.fileName ?? "preparing photos"}</p>}
          {phase === "analyzing" && <p className="flow-status" role="status">Preparing a style profile from your photo set...</p>}
          {phase === "validating" && <p className="flow-status" role="status">Checking image formats...</p>}
          {phase === "loading-profile" && <p className="flow-status" role="status">Checking your saved photos and profile...</p>}
          {phase === "error" && storagePaths.length > 0 && <p className="flow-status">Your photos are uploaded. Retrying will not upload them again.</p>}
          <div className="flow-actions">
            {phase === "error" && storagePaths.length === 0 && savedPhotoCount === 0
              ? <button className="primary-button" type="button" onClick={() => window.location.reload()}>Retry saved-photo check <span aria-hidden="true">↻</span></button>
              : phase === "error" && storagePaths.length > 0
              ? <button className="primary-button" type="button" onClick={() => void startAnalysis()}>Retry analysis <span aria-hidden="true">↗</span></button>
              : <button className="primary-button" type="button" disabled={(photos.length === 0 && existingPhotoPaths.length === 0) || busy} onClick={() => void startAnalysis()}>{phase === "uploading" ? "Uploading photos..." : phase === "analyzing" ? "Preparing suggestions..." : phase === "error" ? "Retry upload" : "Continue"}<span aria-hidden="true">↗</span></button>}
          </div>
        </section>
      ) : (
        <section className="review-layout">
          <div className="review-heading">
            <p className="eyebrow">Step 02 / 02 · Style profile</p>
            <h1>Your style, taking shape.</h1>
            <p>Keep the tags that fit. You can remove anything that doesn't.</p>
          </div>
          {analysis?.isMock && <div className="mock-notice"><span>DEVELOPMENT MOCK</span> These sample suggestions are not AI analysis.</div>}
          {recoveredProfile && <div className="mock-notice saved-profile-notice"><span>SAVED PROFILE</span> This confirmed profile is saved; confirm again only to complete onboarding.</div>}
          <div className="review-details">
            <label className="aesthetic-field">Aesthetic
              <input value={aesthetic} onChange={(event) => setAesthetic(event.target.value)} aria-label="Aesthetic label" />
            </label>
            <div className="keyword-section">
              <div className="keyword-title"><span>Style tags</span><span>{styleTagCount(keywords)} selected</span></div>
              <StyleTagList tags={keywords} onRemove={removeTag} disabled={busy} />
              {styleTagCount(keywords) === 0 && <p className="keyword-empty">No tags selected. Upload new photos to get another set of suggestions.</p>}
            </div>
          </div>
          {error && <p className="flow-error" role="alert">{error}</p>}
          <div className="review-bottom">
            <button type="button" className="text-button" onClick={replacePhotos} disabled={busy}>Replace photos</button>
            <button type="button" className="primary-button" disabled={!aesthetic.trim() || styleTagCount(keywords) === 0 || busy} onClick={() => void confirmStyle()}>
              {phase === "saving" ? "Saving profile..." : "Confirm style profile"}<span aria-hidden="true">↗</span>
            </button>
          </div>
          {analysis?.isMock && <p className="mock-caption">Sample result · {storagePaths.length} private photo{storagePaths.length === 1 ? "" : "s"} uploaded</p>}
          {recoveredProfile && <p className="mock-caption">Previously saved style profile · confirm to finish onboarding</p>}
        </section>
      )}
    </main>
  );
}