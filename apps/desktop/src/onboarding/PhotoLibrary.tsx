import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { MAX_PHOTO_COUNT, validatePhotoFiles } from "./photoValidation";
import { uploadInspirationPhotos, type PhotoUploadProgress } from "./photoStorage";
import { createSignedPhotoUrl, deleteUserPhoto, getUserPhotoGallery, type UserPhoto } from "./photoLibraryApi";

type PhotoLibraryProps = {
  compact?: boolean;
};

type SelectedPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

export function PhotoLibrary({ compact = false }: PhotoLibraryProps) {
  const [photos, setPhotos] = useState<UserPhoto[]>([]);
  const [selected, setSelected] = useState<SelectedPhoto[]>([]);
  const [photoCount, setPhotoCount] = useState(0);
  const [countIsCurrent, setCountIsCurrent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<PhotoUploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [urlFailures, setUrlFailures] = useState<string[]>([]);
  const uploadLock = useRef(false);
  const selectionLock = useRef(false);
  const previewUrls = useRef(new Set<string>());
  const refresh = useCallback(async (preserveCount = false): Promise<boolean> => {
    setLoading(true);
    if (!preserveCount) setCountIsCurrent(false);
    setError(null);
    try {
      const nextPhotos = await getUserPhotoGallery();
      const count = nextPhotos.length;
      setPhotos(nextPhotos);
      setPhotoCount(count);
      setCountIsCurrent(true);
      setUrlFailures([]);
      return true;
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Could not load your saved photos.";
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [photoCount]);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
  }, []);

  function removeSelected(id: string) {
    setSelected((current) => {
      const photo = current.find((item) => item.id === id);
      if (photo) {
        URL.revokeObjectURL(photo.previewUrl);
        previewUrls.current.delete(photo.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
  }

  async function handleSelection(event: ChangeEvent<HTMLInputElement>) {
    if (selectionLock.current) return;
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (files.length === 0) return;

    selectionLock.current = true;
    setValidating(true);
    setError(null);
    setNotice(null);
    try {
      const validation = await validatePhotoFiles(files, photoCount + selected.length);
      setFileErrors(validation.errors);
      if (validation.validFiles.length > 0) {
        setSelected((current) => [...current, ...validation.validFiles.map((file) => {
          const previewUrl = URL.createObjectURL(file);
          previewUrls.current.add(previewUrl);
          return { id: crypto.randomUUID(), file, previewUrl };
        })]);
      }
    } finally {
      selectionLock.current = false;
      setValidating(false);
    }
  }

  async function uploadSelected() {
    if (uploadLock.current || selected.length === 0) return;
    uploadLock.current = true;
    setUploading(true);
    setError(null);
    setNotice(null);
    setFileErrors([]);
    setProgress(null);
    try {
      const result = await uploadInspirationPhotos(selected.map(({ file }) => file), setProgress);
      const savedCount = result.saved.length;
      const successfulIndexes = new Set(result.saved.map(({ fileIndex }) => fileIndex));
      selected.forEach(({ previewUrl }, index) => {
        if (!successfulIndexes.has(index)) return;
        URL.revokeObjectURL(previewUrl);
        previewUrls.current.delete(previewUrl);
      });
      setSelected((current) => current.filter((_, index) => !successfulIndexes.has(index)));
      setFileErrors(result.failed.map(({ fileName, message }) => `${fileName}: ${message}`));
      if (savedCount === 0 && result.failed.length === 0) setError("No photos were saved. Try again.");
      const refreshed = await refresh();
      if (savedCount > 0) {
        const savedNames = result.saved.map(({ fileName }) => fileName).join(", ");
        setNotice(refreshed
          ? `Saved: ${savedNames}.`
          : `Upload saved ${savedCount} photo${savedCount === 1 ? "" : "s"}, but the gallery could not refresh. Refresh before adding more.`);
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Photo upload failed. Your selected photos are still available to retry.");
    } finally {
      uploadLock.current = false;
      setUploading(false);
    }
  }

  async function removeSavedPhoto(photo: UserPhoto) {
    const name = photo.storage_path.split("/").at(-1) ?? "this photo";
    if (!window.confirm(`Permanently remove ${name} from your inspiration photos? Your saved style profile will not change.`)) return;
    setDeletingId(photo.id);
    setError(null);
    setNotice(null);
    try {
      await deleteUserPhoto(photo);
      setPhotos((current) => current.filter(({ id }) => id !== photo.id));
      setPhotoCount((current) => Math.max(0, current - 1));
      setNotice("Photo removed.");
      await refresh(true);
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Could not remove this photo.";
      await refresh();
      setError(message);
    } finally {
      setDeletingId(null);
    }
  }

  async function refreshExpiredUrl(photo: UserPhoto) {
    if (urlFailures.includes(photo.id)) return;
    setUrlFailures((current) => [...current, photo.id]);
    try {
      const signedUrl = await createSignedPhotoUrl(photo.storage_path);
      setPhotos((current) => current.map((item) => item.id === photo.id ? { ...item, signedUrl } : item));
      setUrlFailures((current) => current.filter((id) => id !== photo.id));
    } catch (urlError) {
      setError(urlError instanceof Error ? urlError.message : "Could not refresh a private photo preview.");
    }
  }

  const remaining = Math.max(0, MAX_PHOTO_COUNT - photoCount - selected.length);
  const inputId = compact ? "profile-photo-input" : "onboarding-photo-input";

  return (
    <section className={`photo-library${compact ? " photo-library-compact" : ""}`} aria-label="Inspiration photos">
      <div className="library-heading">
        <div>
          <p className="eyebrow">Inspiration photos</p>
          <h2>Photos that feel like you</h2>
        </div>
        <div className="library-count" aria-live="polite"><strong>{countIsCurrent ? photoCount : "—"}</strong><span> / {MAX_PHOTO_COUNT} photos</span></div>
      </div>

      {loading ? <p className="flow-status" role="status">Loading your saved photos...</p> : null}
      {error && <p className="flow-error" role="alert">{error}</p>}
      {notice && <p className="flow-status" role="status">{notice}</p>}
      {progress && uploading && <p className="flow-status" role="status">{progress.status === "saved" ? "Saved" : "Could not save"} {progress.complete} of {progress.total}: {progress.fileName}</p>}
      {fileErrors.length > 0 && <ul className="file-error-list" aria-label="Photo upload issues">{fileErrors.map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}</ul>}

      {photos.length > 0 ? (
        <div className="photo-grid library-grid">
          {photos.map((photo, index) => (
            <figure className="photo-tile" key={photo.id}>
              {photo.signedUrl && !urlFailures.includes(photo.id)
                ? <img src={photo.signedUrl} alt={`Saved inspiration photo ${index + 1}`} onError={() => void refreshExpiredUrl(photo)} />
                : <div className="photo-unavailable" role="img" aria-label={`Preview unavailable for saved photo ${index + 1}`}>Preview unavailable</div>}
              <button type="button" className="remove-photo" aria-label={`Remove saved inspiration photo ${index + 1}`} disabled={uploading || deletingId !== null} onClick={() => void removeSavedPhoto(photo)}>
                {deletingId === photo.id ? "…" : "×"}
              </button>
            </figure>
          ))}
        </div>
      ) : !loading ? (
        <p className="library-empty">No inspiration photos saved yet. Add a few images to get started.</p>
      ) : null}

      {selected.length > 0 && (
        <div className="selected-photos">
          <p className="eyebrow">Ready to upload · {selected.length}</p>
          <div className="photo-grid library-grid">
            {selected.map((photo, index) => (
              <figure className="photo-tile" key={photo.id}>
                <img src={photo.previewUrl} alt={`Selected inspiration photo ${index + 1}: ${photo.file.name}`} />
                <button type="button" className="remove-photo" aria-label={`Remove selected ${photo.file.name}`} disabled={uploading} onClick={() => removeSelected(photo.id)}>×</button>
              </figure>
            ))}
          </div>
        </div>
      )}

      <div className="library-actions">
        {!countIsCurrent ? <p className="limit-message" role="status">Refresh your photo collection before adding images.</p> : remaining > 0 ? (
          <>
            <label className="secondary-button profile-action" htmlFor={inputId}>Add photos <span aria-hidden="true">+</span></label>
            <input id={inputId} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={loading || validating || uploading || deletingId !== null || remaining <= 0} onChange={(event) => void handleSelection(event)} />
          </>
        ) : <p className="limit-message" role="status">Your photo collection is full. Remove a photo to add another.</p>}
        {selected.length > 0 && <button type="button" className="primary-button" disabled={!countIsCurrent || uploading || validating || loading} onClick={() => void uploadSelected()}>{uploading ? "Saving photos..." : validating ? "Checking photos..." : `Upload ${selected.length} photo${selected.length === 1 ? "" : "s"}`}<span aria-hidden="true">↗</span></button>}
      </div>
    </section>
  );
}