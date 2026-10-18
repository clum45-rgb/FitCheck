import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import { PhotoLibrary } from "../onboarding/PhotoLibrary.tsx";
import { analyzeStylePhotos } from "../onboarding/styleAnalysis";
import { getUserPhotoMetadata } from "../onboarding/photoLibraryApi";
import { StyleTagList, styleTagFieldLabels } from "../onboarding/StyleTagList";
import {
  getConfirmedStyleProfile,
  mergeProfileTags,
  normalizeStyleProfile,
  profileAnalysisSignature,
  profileTagsFromPreferenceState,
  updateSavedStyleProfile,
  type ConfirmedStyleProfile,
  type ProfilePreferenceState,
} from "../onboarding/styleProfiles";
import {
  MAX_PROFILE_TAG_LENGTH,
  STYLE_TAG_FIELDS,
  addProfileTag,
  coerceProfileTags,
  emptyProfileTags,
  profileTagCount,
  withoutProfileTag,
  type ProfileTags,
  type StyleTagField,
} from "../style-profile";

type HomeScreenProps = {
  onCompleteSetup: () => void;
};

function oneTag(field: StyleTagField, value: string): ProfileTags {
  return { ...emptyProfileTags(), [field]: [value] };
}

function sameTags(left: ProfileTags, right: ProfileTags) {
  return STYLE_TAG_FIELDS.every((field) => JSON.stringify(left[field]) === JSON.stringify(right[field]));
}

function analyzedPhotoPaths(signature: string | null): string[] | null {
  if (!signature) return null;
  try {
    const parsed = JSON.parse(signature) as { photoPaths?: unknown };
    if (!Array.isArray(parsed.photoPaths) || parsed.photoPaths.some((path) => typeof path !== "string")) return null;
    return [...parsed.photoPaths].sort();
  } catch {
    return null;
  }
}

export function HomeScreen({ onCompleteSetup }: HomeScreenProps) {
  const { session } = useAuth();
  const email = session?.user.email ?? "";
  const [styleProfile, setStyleProfile] = useState<ConfirmedStyleProfile | null>(null);
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [draftKeywords, setDraftKeywords] = useState<ProfileTags | null>(null);
  const [draftPreference, setDraftPreference] = useState<ProfilePreferenceState | null>(null);
  const [addingField, setAddingField] = useState<StyleTagField | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [addValue, setAddValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [photoPaths, setPhotoPaths] = useState<string[] | null>(null);
  const handlePhotosChange = useCallback((paths: string[]) => setPhotoPaths(paths), []);
  const refreshLock = useRef(false);
  const profileRef = useRef<ConfirmedStyleProfile | null>(null);
  const cancelRef = useRef<() => void>(() => {});
  profileRef.current = styleProfile;

  async function loadStyleProfile() {
    setLoading(true);
    setError(null);
    try {
      setStyleProfile(await getConfirmedStyleProfile());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load your style profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStyleProfile();
  }, []);

  function openTagEditor() {
    if (!styleProfile) return;
    setDraftKeywords(styleProfile.keywords);
    setDraftPreference(styleProfile.preferenceState);
    setAddingField(null);
    setAddValue("");
    setAddError(null);
    setSaveError(null);
    setConfirmLeave(false);
    setTagEditorOpen(true);
  }

  function discardTagEditor() {
    setAddingField(null);
    setConfirmLeave(false);
    setTagEditorOpen(false);
  }

  function removeDraftTag(field: StyleTagField, value: string) {
    if (!draftKeywords || !draftPreference) return;
    const nextKeywords = withoutProfileTag(draftKeywords, field, value);
    if (profileTagCount(nextKeywords) === 0) {
      setSaveError("Keep at least one style tag.");
      return;
    }
    setSaveError(null);
    setDraftKeywords(nextKeywords);
    setDraftPreference({
      ...draftPreference,
      manualTags: withoutProfileTag(draftPreference.manualTags, field, value),
      keptTags: withoutProfileTag(draftPreference.keptTags, field, value),
      dismissedTags: mergeProfileTags(draftPreference.dismissedTags, oneTag(field, value)),
    });
  }

  function openAddTag(field: StyleTagField) {
    setAddingField(field);
    setAddValue("");
    setAddError(null);
  }

  function submitAddTag(event: FormEvent) {
    event.preventDefault();
    if (!addingField || !draftKeywords || !draftPreference) return;
    const result = addProfileTag(draftKeywords, addingField, addValue);
    if (result.error) {
      setAddError(result.error);
      return;
    }
    setDraftKeywords(result.tags);
    setDraftPreference({
      ...draftPreference,
      manualTags: mergeProfileTags(draftPreference.manualTags, oneTag(addingField, addValue.trim())),
      dismissedTags: withoutProfileTag(draftPreference.dismissedTags, addingField, addValue.trim()),
    });
    setSaveError(null);
    setAddingField(null);
    setAddValue("");
    setAddError(null);
  }

  async function saveTagChanges() {
    const current = profileRef.current;
    if (!current || !draftKeywords || !draftPreference || saving) return false;
    if (profileTagCount(draftKeywords) === 0) {
      setSaveError("Keep at least one style tag.");
      return false;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const normalized = normalizeStyleProfile(current.aesthetic, draftKeywords);
      await updateSavedStyleProfile(normalized.aesthetic, normalized.keywords, draftPreference);
      const nextProfile = {
        ...current,
        aesthetic: normalized.aesthetic,
        keywords: normalized.keywords,
        preferenceState: draftPreference,
        confirmed_at: new Date().toISOString(),
      };
      profileRef.current = nextProfile;
      setStyleProfile(nextProfile);
      discardTagEditor();
      return true;
    } catch (saveFailure) {
      setSaveError(saveFailure instanceof Error ? saveFailure.message : "Could not save your tags.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  const tagsChanged = Boolean(styleProfile && draftKeywords && !sameTags(draftKeywords, styleProfile.keywords));

  function cancelTagEditor() {
    if (saving) return;
    if (tagsChanged) {
      setConfirmLeave(true);
      return;
    }
    discardTagEditor();
  }

  cancelRef.current = () => {
    if (addingField) {
      setAddingField(null);
      setAddError(null);
      return;
    }
    if (confirmLeave) {
      setConfirmLeave(false);
      return;
    }
    cancelTagEditor();
  };

  async function startRefresh() {
    if (!styleProfile || refreshLock.current) return;
    if (!window.confirm("Reanalyze Profile will look at your current inspiration photos and update the AI-generated aesthetic and tags. Continue?")) return;

    refreshLock.current = true;
    setRefreshing(true);
    setRefreshError(null);
    setRefreshNotice(null);
    try {
      const photoPaths = (await getUserPhotoMetadata()).map(({ storage_path }) => storage_path).sort();
      if (photoPaths.length === 0) throw new Error("Add an inspiration photo before refreshing profile preferences.");
      const signature = profileAnalysisSignature(photoPaths, styleProfile.preferenceState);
      if (signature === styleProfile.preferenceState.lastAnalysisSignature) {
        setRefreshNotice("Your profile is already up to date.");
        return;
      }
      const result = await analyzeStylePhotos(photoPaths, {
        aesthetic: styleProfile.aesthetic,
        keywords: styleProfile.keywords,
      });
      const nextPreferenceState = {
        ...styleProfile.preferenceState,
        aiTags: coerceProfileTags(result.keywords),
        lastAnalysisSignature: signature,
      };
      const nextTags = profileTagsFromPreferenceState(nextPreferenceState);
      const normalized = normalizeStyleProfile(result.aesthetic, nextTags);
      await updateSavedStyleProfile(normalized.aesthetic, normalized.keywords, nextPreferenceState);
      const nextProfile = {
        ...styleProfile,
        aesthetic: normalized.aesthetic,
        keywords: normalized.keywords,
        preferenceState: nextPreferenceState,
        confirmed_at: new Date().toISOString(),
      };
      profileRef.current = nextProfile;
      setStyleProfile(nextProfile);
      setRefreshNotice("Your updated style preferences are saved.");
    } catch (refreshFailure) {
      setRefreshError(refreshFailure instanceof Error ? refreshFailure.message : "Could not reanalyze your profile.");
    } finally {
      refreshLock.current = false;
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!tagEditorOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelRef.current();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [tagEditorOpen]);

  const analyzedPaths = analyzedPhotoPaths(styleProfile?.preferenceState.lastAnalysisSignature ?? null);
  const photosChanged = photoPaths !== null && (
    analyzedPaths === null
      ? photoPaths.length > 0
      : JSON.stringify(photoPaths) !== JSON.stringify(analyzedPaths)
  );

  return (
    <main className="progress-screen profile-screen">
      <header className="app-header">
        <div className="wordmark">FITSPO</div>
        {email && <span className="app-header-label app-header-email">{email}</span>}
      </header>
      <section className="home-content">
        <div className="profile-title-row">
          <div>
            <p className="eyebrow">YOUR STYLE, IN FOCUS</p>
            <h1>Your Style Profile</h1>
          </div>
        </div>

        <div className="profile-layout">
        <div className="profile-main">
        {loading ? <p className="flow-status" role="status">Loading your saved style profile...</p> : error ? (
          <div className="home-error"><p role="alert">{error}</p><button className="text-button" type="button" onClick={() => void loadStyleProfile()}>Try again</button></div>
        ) : styleProfile ? (
          <section className="saved-style" aria-label="Confirmed style profile">
            <p className="eyebrow">Aesthetic</p>
            <div className="aesthetic-box">
              <h2>{styleProfile.aesthetic}</h2>
            </div>
            <div className="style-tags">
              <div className="keyword-title saved-keyword-title style-tags-heading">
                <span>Style tags</span>
                <button className="secondary-button profile-action" type="button" onClick={openTagEditor}>Edit tags <span aria-hidden="true"><svg viewBox="0 0 24 24" width="15" height="15"><path fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg></span></button>
              </div>
              <StyleTagList tags={styleProfile.keywords} />
            </div>
          </section>
        ) : (
          <section className="profile-empty">
            <p className="eyebrow">No confirmed style yet</p>
            <h2>Start with the looks you love.</h2>
            <p>Complete the inspiration flow to save your aesthetic and style tags here.</p>
            <button className="primary-button" type="button" onClick={onCompleteSetup}>Continue setup <span aria-hidden="true">↗</span></button>
          </section>
        )}

        <div className="refresh-preferences refresh-preferences-after-photos">
          <div>
            <h2>Reanalyze Profile</h2>
            <p>Reanalyze your current saved inspiration photos to update the AI-generated aesthetic and tags.</p>
          </div>
          {refreshNotice && <p className="flow-status" role="status">{refreshNotice}</p>}
          {refreshError && <p className="flow-error" role="alert">{refreshError}</p>}
          <button type="button" className={`secondary-button profile-action${photosChanged ? "" : " is-idle"}${refreshing ? " is-reanalyzing" : ""}`} disabled={!photosChanged || !styleProfile || loading || saving || refreshing} onClick={() => void startRefresh()}>
            {refreshing ? <span className="button-spinner" role="status" aria-label="Reanalyzing profile" /> : "Reanalyze Profile"}
          </button>
        </div>
        </div>
        <PhotoLibrary compact onPhotosChange={handlePhotosChange} />
        </div>
        {tagEditorOpen && styleProfile && draftKeywords && (
          <div className="tag-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) cancelTagEditor(); }}>
            <div className="tag-modal" role="dialog" aria-modal="true" aria-labelledby="tag-editor-title">
              <h2 id="tag-editor-title">Edit tags</h2>
              {saveError && <p className="flow-error" role="alert">{saveError}</p>}
              <div className="style-tags">
                <StyleTagList tags={draftKeywords} disabled={saving} onRemove={removeDraftTag} onRequestAdd={openAddTag} />
              </div>
              {confirmLeave ? (
                <div className="tag-leave-prompt" role="group" aria-label="Leave without saving?">
                  <p>Leave without saving?</p>
                  <div className="tag-modal-actions">
                    <button type="button" className="text-button" onClick={() => setConfirmLeave(false)}>No</button>
                    <button type="button" className="tag-modal-save" onClick={discardTagEditor}>Yes</button>
                  </div>
                </div>
              ) : (
                <div className="tag-modal-actions">
                  <button type="button" className="text-button" disabled={saving} onClick={cancelTagEditor}>Cancel</button>
                  <button type="button" className="tag-modal-save" disabled={!tagsChanged || saving} onClick={() => void saveTagChanges()}>{saving ? "Saving..." : "Save"}</button>
                </div>
              )}
              {addingField && (
                <div className="tag-add-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setAddingField(null); }}>
                  <form className="tag-add-popup" onSubmit={submitAddTag}>
                    <h3>Add a {styleTagFieldLabels[addingField].toLowerCase()} tag</h3>
                    <label className="visually-hidden" htmlFor="custom-tag-input">Custom {styleTagFieldLabels[addingField].toLowerCase()} tag</label>
                    <input id="custom-tag-input" autoFocus value={addValue} maxLength={MAX_PROFILE_TAG_LENGTH} placeholder={`Type a ${styleTagFieldLabels[addingField].toLowerCase()}`} onChange={(event) => setAddValue(event.target.value)} />
                    {addError && <p className="flow-error" role="alert">{addError}</p>}
                    <div className="tag-modal-actions">
                      <button type="button" className="text-button" onClick={() => setAddingField(null)}>Cancel</button>
                      <button type="submit" className="tag-modal-save" disabled={addValue.trim().length === 0}>Add</button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}