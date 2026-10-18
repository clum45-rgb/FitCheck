import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { MAX_PHOTO_COUNT, validatePhotoFiles } from "./photoValidation";
import { uploadInspirationPhotos, type PhotoUploadProgress } from "./photoStorage";
import { createSignedPhotoUrl, deleteUserPhoto, getUserPhotoGallery, type UserPhoto } from "./photoLibraryApi";

const cameraIcon = (
  <svg viewBox="0 0 24 24" width="15" height="15">
    <path fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" fill="none" stroke="#fff" strokeWidth="2" />
  </svg>
);

type PhotoLibraryProps = {
  compact?: boolean;
  onPhotosChange?: (storagePaths: string[]) => void;
};

type SelectedPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

export function PhotoLibrary({ compact = false, onPhotosChange }: PhotoLibraryProps) {
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
  const [editorOpen, setEditorOpen] = useState(false);
  const [pendingRemovals, setPendingRemovals] = useState<string[]>([]);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const uploadLock = useRef(false);
  const selectionLock = useRef(false);
  const previewUrls = useRef(new Set<string>());
  const cancelRef = useRef<() => void>(() => {});
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
      onPhotosChange?.(nextPhotos.map((photo) => photo.storage_path).sort());
      return true;
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Could not load your saved photos.";
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [onPhotosChange, photoCount]);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!editorOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelRef.current();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [editorOpen]);

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
  }, []);

  function discardSelected() {
    setSelected((current) => {
      current.forEach(({ previewUrl }) => {
        URL.revokeObjectURL(previewUrl);
        previewUrls.current.delete(previewUrl);
      });
      return [];
    });
    setPendingRemovals([]);
    setFileErrors([]);
  }

  function closeEditor() {
    if (uploading) return;
    setConfirmLeave(false);
    setNotice(null);
    discardSelected();
    setEditorOpen(false);
  }

  function cancelEditor() {
    if (uploading) return;
    if (selected.length > 0 || pendingRemovals.length > 0) {
      setConfirmLeave(true);
      return;
    }
    closeEditor();
  }

  cancelRef.current = () => {
    if (confirmLeave) {
      setConfirmLeave(false);
      return;
    }
    cancelEditor();
  };

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
      const currentCount = compact
        ? photos.filter((photo) => !pendingRemovals.includes(photo.id)).length
        : photoCount;
      const validation = await validatePhotoFiles(files, currentCount + selected.length);
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
      if (savedCount > 0 && result.failed.length === 0) {
        setConfirmLeave(false);
        setNotice(null);
        setEditorOpen(false);
        return;
      }
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

  async function saveEditorChanges() {
    if (uploadLock.current || (selected.length === 0 && pendingRemovals.length === 0)) return;
    uploadLock.current = true;
    setUploading(true);
    setError(null);
    setNotice(null);
    setFileErrors([]);
    setProgress(null);
    try {
      if (pendingRemovals.length > 0) {
        const toRemove = photos.filter((photo) => pendingRemovals.includes(photo.id));
        for (const photo of toRemove) {
          await deleteUserPhoto(photo);
        }
        setPendingRemovals([]);
      }

      let failedCount = 0;
      if (selected.length > 0) {
        const result = await uploadInspirationPhotos(selected.map(({ file }) => file), setProgress);
        failedCount = result.failed.length;
        const successfulIndexes = new Set(result.saved.map(({ fileIndex }) => fileIndex));
        selected.forEach(({ previewUrl }, index) => {
          if (!successfulIndexes.has(index)) return;
          URL.revokeObjectURL(previewUrl);
          previewUrls.current.delete(previewUrl);
        });
        setSelected((current) => current.filter((_, index) => !successfulIndexes.has(index)));
        setFileErrors(result.failed.map(({ fileName, message }) => `${fileName}: ${message}`));
        if (result.saved.length === 0 && failedCount === 0) setError("No photos were saved. Try again.");
      }

      await refresh();
      if (failedCount === 0) {
        setConfirmLeave(false);
        setNotice(null);
        setEditorOpen(false);
      }
    } catch (saveError) {
      await refresh();
      setError(saveError instanceof Error ? saveError.message : "Could not save photo changes. Try again.");
    } finally {
      uploadLock.current = false;
      setUploading(false);
    }
  }

  function queueRemoveSaved(photo: UserPhoto) {
    setPendingRemovals((current) => current.includes(photo.id) ? current : [...current, photo.id]);
    setError(null);
    setNotice(null);
  }

  async function removeSavedPhoto(photo: UserPhoto) {
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

  const editorSavedPhotos = compact ? photos.filter((photo) => !pendingRemovals.includes(photo.id)) : photos;
  const remaining = Math.max(0, MAX_PHOTO_COUNT - (compact ? editorSavedPhotos.length : photoCount) - selected.length);
  const editorChanged = selected.length > 0 || pendingRemovals.length > 0;
  const editorCount = editorSavedPhotos.length + selected.length;
  const inputId = compact ? "profile-photo-input" : "onboarding-photo-input";

  function savedPhotos(removable: boolean) {
    const visiblePhotos = removable && compact ? editorSavedPhotos : photos;
    if (visiblePhotos.length === 0) {
      return loading ? null : <p className="library-empty">No inspiration photos saved yet. Add a few images to get started.</p>;
    }
    const compactLayout = !compact ? "" : visiblePhotos.length <= 4 ? " library-grid--2" : visiblePhotos.length <= 6 ? " library-grid--2x3" : " library-grid--3";
    return (
      <div className={`photo-grid library-grid${compactLayout}`}>
        {visiblePhotos.map((photo, index) => (
          <figure className="photo-tile" key={photo.id}>
            {photo.signedUrl && !urlFailures.includes(photo.id)
              ? <img src={photo.signedUrl} alt={`Saved inspiration photo ${index + 1}`} onError={() => void refreshExpiredUrl(photo)} />
              : <div className="photo-unavailable" role="img" aria-label={`Preview unavailable for saved photo ${index + 1}`}>Preview unavailable</div>}
            {removable && (
              <button type="button" className="remove-photo" aria-label={`Remove saved inspiration photo ${index + 1}`} disabled={uploading || deletingId !== null} onClick={() => compact ? queueRemoveSaved(photo) : void removeSavedPhoto(photo)}>
                {deletingId === photo.id ? "…" : "×"}
              </button>
            )}
          </figure>
        ))}
      </div>
    );
  }

  function pendingPhotos() {
    if (selected.length === 0) return null;
    return (
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
    );
  }

  function editorStatus() {
    return (
      <>
        {loading ? <p className="flow-status" role="status">Loading your saved photos...</p> : null}
        {error && <p className="flow-error" role="alert">{error}</p>}
        {notice && <p className="flow-status" role="status">{notice}</p>}
        {progress && uploading && <p className="flow-status" role="status">{progress.status === "saved" ? "Saved" : "Could not save"} {progress.complete} of {progress.total}: {progress.fileName}</p>}
        {fileErrors.length > 0 && <ul className="file-error-list" aria-label="Photo upload issues">{fileErrors.map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}</ul>}
      </>
    );
  }

  function addPhotosControl(controlId = inputId, includeUpload = true) {
    return (
      <div className="library-actions">
        {!countIsCurrent ? <p className="limit-message" role="status">Refresh your photo collection before adding images.</p> : remaining > 0 ? (
          <>
            <label className="secondary-button profile-action" htmlFor={controlId}>Add photos <span aria-hidden="true">+</span></label>
            <input id={controlId} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={loading || validating || uploading || deletingId !== null || remaining <= 0} onChange={(event) => void handleSelection(event)} />
          </>
        ) : <p className="limit-message" role="status">Your photo collection is full. Remove a photo to add another.</p>}
        {includeUpload && selected.length > 0 && <button type="button" className="primary-button" disabled={!countIsCurrent || uploading || validating || loading} onClick={() => void uploadSelected()}>{uploading ? "Saving photos..." : validating ? "Checking photos..." : `Upload ${selected.length} photo${selected.length === 1 ? "" : "s"}`}<span aria-hidden="true">↗</span></button>}
      </div>
    );
  }

  return (
    <section className={`photo-library${compact ? " photo-library-compact" : ""}`} aria-label="Inspiration photos">
      <div className="library-heading">
        <div>
          <p className="eyebrow">Inspiration photos</p>
          <div className="library-title-row">
            <h2>Photos that feel like you</h2>
            {compact && (
              <button className="secondary-button profile-action" type="button" onClick={() => setEditorOpen(true)}>
                Edit photos <span aria-hidden="true">{cameraIcon}</span>
              </button>
            )}
          </div>
        </div>
        {!compact && <div className="library-count" aria-live="polite"><strong>{countIsCurrent ? photoCount : "—"}</strong><span> / {MAX_PHOTO_COUNT} photos</span></div>}
      </div>

      {compact ? (
        <>
          {loading ? <p className="flow-status" role="status">Loading your saved photos...</p> : null}
          {error && <p className="flow-error" role="alert">{error}</p>}
          <div className="library-board">
            {!loading && savedPhotos(false)}
          </div>
        </>
      ) : (
        <>
          {editorStatus()}
          {savedPhotos(true)}
          {pendingPhotos()}
          {addPhotosControl()}
        </>
      )}

      {compact && editorOpen && (
        <div className="tag-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) cancelEditor(); }}>
          <div className="tag-modal" role="dialog" aria-modal="true" aria-labelledby="photo-editor-title">
            <div className="photo-modal-heading">
              <h2 id="photo-editor-title">Edit photos</h2>
              <p className="photo-editor-count" aria-live="polite">{countIsCurrent ? editorCount : "—"} / {MAX_PHOTO_COUNT}</p>
            </div>
            {editorStatus()}
            {savedPhotos(true)}
            {pendingPhotos()}
            {addPhotosControl("profile-photo-input-editor", false)}
            {confirmLeave ? (
              <div className="tag-leave-prompt" role="group" aria-label="Leave without saving?">
                <p>Leave without saving?</p>
                <div className="tag-modal-actions">
                  <button type="button" className="text-button" onClick={() => setConfirmLeave(false)}>No</button>
                  <button type="button" className="tag-modal-save" onClick={closeEditor}>Yes</button>
                </div>
              </div>
            ) : (
              <div className="tag-modal-actions">
                <button type="button" className="text-button" disabled={uploading} onClick={cancelEditor}>Cancel</button>
                <button type="button" className="tag-modal-save" disabled={!editorChanged || uploading || validating || loading} onClick={() => void saveEditorChanges()}>{uploading ? "Saving..." : "Save"}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
