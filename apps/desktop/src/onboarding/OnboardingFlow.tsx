import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { MAX_PHOTO_COUNT, validatePhotoFiles } from "./photoValidation";
import { uploadInspirationPhotos, type PhotoUploadProgress } from "./photoStorage";
import { analyzeStylePhotos, type StyleAnalysis } from "./styleAnalysis";
import { StyleTagList } from "./StyleTagList";
import {
  emptyProfilePreferenceState,
  getConfirmedStyleProfile,
  mergeProfileTags,
  profileAnalysisSignature,
  saveConfirmedStyleProfile,
  type ProfilePreferenceState,
} from "./styleProfiles";
import { createSignedPhotoUrl, deleteUserPhoto, getUserPhotoGallery, type UserPhoto } from "./photoLibraryApi";
import { coerceProfileTags, emptyProfileTags, profileTagCount, withoutProfileTag, type ProfileTags, type StyleTagField } from "../style-profile";

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
  const [existingPhotos, setExistingPhotos] = useState<UserPhoto[]>([]);
  const [existingPhotoPaths, setExistingPhotoPaths] = useState<string[]>([]);
  const [savedPhotoCount, setSavedPhotoCount] = useState(0);
  const [savedCountLoaded, setSavedCountLoaded] = useState(false);
  const [analysis, setAnalysis] = useState<StyleAnalysis | null>(null);
  const [analysisPhotoPaths, setAnalysisPhotoPaths] = useState<string[]>([]);
  const [aesthetic, setAesthetic] = useState("");
  const [keywords, setKeywords] = useState<ProfileTags>(emptyProfileTags);
  const [dismissedTags, setDismissedTags] = useState<ProfileTags>(emptyProfileTags);
  const [savedPreferenceState, setSavedPreferenceState] = useState<ProfilePreferenceState | null>(null);
  const [phase, setPhase] = useState<"loading-profile" | "ready" | "validating" | "uploading" | "analyzing" | "review" | "saving" | "error">("loading-profile");
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<PhotoUploadProgress | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [photoPreviewFailures, setPhotoPreviewFailures] = useState<string[]>([]);
  const [recoveredProfile, setRecoveredProfile] = useState(false);
  const previewUrls = useRef(new Set<string>());
  const submitLock = useRef(false);

  const busy = phase === "loading-profile" || phase === "validating" || phase === "uploading" || phase === "analyzing" || phase === "saving" || deletingPhotoId !== null;

  useEffect(() => {
    let active = true;
    async function loadSavedState() {
      setPhase("loading-profile");
      setError(null);
      try {
        const [savedPhotos, savedProfile] = await Promise.all([
          getUserPhotoGallery(),
          isReplacement ? Promise.resolve(null) : getConfirmedStyleProfile(),
        ]);
        if (!active) return;
        setExistingPhotos(savedPhotos);
        setExistingPhotoPaths(savedPhotos.map(({ storage_path }) => storage_path));
        setSavedPhotoCount(savedPhotos.length);
        setSavedCountLoaded(true);
        if (savedProfile) {
          setAesthetic(savedProfile.aesthetic);
          setKeywords(savedProfile.keywords);
          setSavedPreferenceState(savedProfile.preferenceState);
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

  async function removeSavedPhoto(photo: UserPhoto) {
    const name = photo.storage_path.split("/").at(-1) ?? "this photo";
    if (!window.confirm(`Permanently remove ${name} from your inspiration photos?`)) return;
    setDeletingPhotoId(photo.id);
    setError(null);
    try {
      await deleteUserPhoto(photo);
      const nextPhotos = existingPhotos.filter(({ id }) => id !== photo.id);
      const nextPaths = nextPhotos.map(({ storage_path }) => storage_path);
      setExistingPhotos(nextPhotos);
      setExistingPhotoPaths(nextPaths);
      setSavedPhotoCount(nextPhotos.length);
      setStoragePaths((current) => current.filter((path) => path !== photo.storage_path));
      setPhotoPreviewFailures((current) => current.filter((id) => id !== photo.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not remove this photo.");
    } finally {
      setDeletingPhotoId(null);
    }
  }

  async function refreshPhotoPreview(photo: UserPhoto) {
    if (photoPreviewFailures.includes(photo.id)) return;
    setPhotoPreviewFailures((current) => [...current, photo.id]);
    try {
      const signedUrl = await createSignedPhotoUrl(photo.storage_path);
      setExistingPhotos((current) => current.map((item) => item.id === photo.id ? { ...item, signedUrl } : item));
      setPhotoPreviewFailures((current) => current.filter((id) => id !== photo.id));
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Could not load a saved photo preview.");
    }
  }

  async function startAnalysis() {
    if (submitLock.current) return;
    submitLock.current = true;
    setError(null);
    setUploadProgress(null);
    try {
      let paths = storagePaths;
      if (photos.length > 0) {
        setPhase("uploading");
        const uploadResult = await uploadInspirationPhotos(photos.map(({ file }) => file), setUploadProgress);
        const uploadedPaths = uploadResult.saved.map(({ storagePath }) => storagePath);
        const failedIndexes = new Set(uploadResult.failed.map(({ fileIndex }) => fileIndex));
        photos.forEach((photo, index) => {
          if (failedIndexes.has(index)) return;
          URL.revokeObjectURL(photo.previewUrl);
          previewUrls.current.delete(photo.previewUrl);
        });
        setPhotos((current) => current.filter((_, index) => failedIndexes.has(index)));
        setSavedPhotoCount((count) => count + uploadedPaths.length);
        if (uploadResult.failed.length > 0) {
          const savedCount = uploadResult.saved.length;
          setError(`${savedCount} photo${savedCount === 1 ? " was" : "s were"} saved. ${uploadResult.failed.map(({ fileName, message }) => `${fileName}: ${message}`).join(" ")}`);
        }
        if (uploadedPaths.length === 0) {
          throw new Error(uploadResult.failed.map(({ message }) => message).join(" ") || "No photos were saved.");
        }
        const persistedPhotos = await getUserPhotoGallery();
        setExistingPhotos(persistedPhotos);
        setPhotoPreviewFailures([]);
        setSavedPhotoCount(persistedPhotos.length);
        setExistingPhotoPaths(persistedPhotos.map(({ storage_path }) => storage_path));
        paths = persistedPhotos.map(({ storage_path }) => storage_path);
        setStoragePaths(paths);
      }
      if (paths.length === 0) paths = existingPhotoPaths;
      if (paths.length === 0) throw new Error("Add at least one inspiration photo before continuing.");
      setPhase("analyzing");
      const result = await analyzeStylePhotos(paths);
      setAnalysis(result);
      setAnalysisPhotoPaths(paths);
      setDismissedTags(emptyProfileTags());
      setSavedPreferenceState(null);
      setAesthetic(result.aesthetic);
      setKeywords(coerceProfileTags(result.keywords));
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
    setKeywords(emptyProfileTags());
    setError(null);
    setPhase("ready");
    setRecoveredProfile(false);
  }

  function removeTag(field: StyleTagField, value: string) {
    setKeywords((current) => withoutProfileTag(current, field, value));
    setDismissedTags((current) => mergeProfileTags(current, {
      ...emptyProfileTags(),
      [field]: [value],
    }));
  }

  async function confirmStyle() {
    setError(null);
    setPhase("saving");
    try {
      const preferenceState = { ...(savedPreferenceState ?? emptyProfilePreferenceState()) };
      if (analysis) {
        preferenceState.aiTags = coerceProfileTags(analysis.keywords);
        preferenceState.dismissedTags = dismissedTags;
        preferenceState.lastAnalysisSignature = profileAnalysisSignature(analysisPhotoPaths, emptyProfilePreferenceState());
      }
      await saveConfirmedStyleProfile(aesthetic, keywords, preferenceState);
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

          {savedCountLoaded && savedPhotoCount + photos.length >= MAX_PHOTO_COUNT && <p className="limit-message" role="status">Your photo collection is full. Remove a photo below to add another.</p>}
          {photos.length === 0 && existingPhotos.length === 0 ? (
            <label className="drop-zone" htmlFor="photo-input">
              <span className="drop-mark" aria-hidden="true">+</span>
              <strong>Choose inspiration photos</strong>
              <span>JPEG, PNG or WebP · up to 5 MB each</span>
            </label>
          ) : (
            <div className="photo-grid" aria-label="Inspiration photos">
              {existingPhotos.map((photo, index) => (
                <figure className="photo-tile" key={photo.id}>
                  {photo.signedUrl && !photoPreviewFailures.includes(photo.id)
                    ? <img src={photo.signedUrl} alt={`Saved inspiration photo ${index + 1}`} onError={() => void refreshPhotoPreview(photo)} />
                    : <div className="photo-unavailable" role="img" aria-label={`Preview unavailable for saved photo ${index + 1}`}>Preview unavailable</div>}
                  <button type="button" className="remove-photo" aria-label={`Remove saved inspiration photo ${index + 1}`} onClick={() => void removeSavedPhoto(photo)} disabled={busy}>
                    {deletingPhotoId === photo.id ? "…" : "×"}
                  </button>
                </figure>
              ))}
              {photos.map((photo, index) => (
                <figure className="photo-tile" key={photo.id}>
                  <img src={photo.previewUrl} alt={`Selected inspiration photo ${existingPhotos.length + index + 1}: ${photo.file.name}`} />
                  <button type="button" className="remove-photo" aria-label={`Remove ${photo.file.name}`} onClick={() => removePhoto(photo.id)} disabled={busy}>×</button>
                </figure>
              ))}
              {savedPhotoCount + photos.length < MAX_PHOTO_COUNT && <label className="add-photo-tile" htmlFor="photo-input">+<span>Add more</span></label>}
            </div>
          )}

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
            <div className="aesthetic-field"><span>Aesthetic</span>
              <strong className="aesthetic-value">{aesthetic}</strong>
            </div>
            <div className="keyword-section">
              <div className="keyword-title"><span>Style tags</span><span>{profileTagCount(keywords)} selected</span></div>
              <StyleTagList tags={keywords} onRemove={removeTag} disabled={busy} />
              {profileTagCount(keywords) === 0 && <p className="keyword-empty">No tags selected. Upload new photos to get another set of suggestions.</p>}
            </div>
          </div>
          {error && <p className="flow-error" role="alert">{error}</p>}
          <div className="review-bottom">
            <button type="button" className="text-button" onClick={replacePhotos} disabled={busy}>Replace photos</button>
            <button type="button" className="primary-button" disabled={!aesthetic.trim() || profileTagCount(keywords) === 0 || busy} onClick={() => void confirmStyle()}>
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