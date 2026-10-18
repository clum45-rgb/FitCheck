import { useEffect, useRef, useState } from "react";
import { PhotoLibrary } from "../onboarding/PhotoLibrary.tsx";
import { analyzeStylePhotos } from "../onboarding/styleAnalysis";
import { getUserPhotoMetadata } from "../onboarding/photoLibraryApi";
import { StyleTagList } from "../onboarding/StyleTagList";
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
  STYLE_TAG_FIELDS,
  addProfileTag,
  coerceProfileTags,
  emptyProfileTags,
  normalizeProfileTagKey,
  profileTagCount,
  withoutProfileTag,
  type ProfileTags,
  type StyleTagField,
} from "../style-profile";

type HomeScreenProps = {
  displayName: string | null;
  onSaveDisplayName: (displayName: string) => Promise<void>;
  onCompleteSetup: () => void;
};

function oneTag(field: StyleTagField, value: string): ProfileTags {
  return { ...emptyProfileTags(), [field]: [value] };
}

function sameTags(left: ProfileTags, right: ProfileTags) {
  return STYLE_TAG_FIELDS.every((field) => JSON.stringify(left[field]) === JSON.stringify(right[field]));
}

function samePreferenceDecisions(left: ProfilePreferenceState, right: ProfilePreferenceState) {
  return sameTags(left.manualTags, right.manualTags)
    && sameTags(left.keptTags, right.keptTags)
    && sameTags(left.dismissedTags, right.dismissedTags);
}

function includesTag(tags: ProfileTags, field: StyleTagField, value: string) {
  return tags[field].some((tag) => normalizeProfileTagKey(tag) === normalizeProfileTagKey(value));
}

export function HomeScreen({ displayName, onSaveDisplayName, onCompleteSetup }: HomeScreenProps) {
  const [styleProfile, setStyleProfile] = useState<ConfirmedStyleProfile | null>(null);
  const [draftDisplayName, setDraftDisplayName] = useState(displayName ?? "");
  const [draftKeywords, setDraftKeywords] = useState<ProfileTags>(emptyProfileTags);
  const [draftPreferenceState, setDraftPreferenceState] = useState<ProfilePreferenceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const refreshLock = useRef(false);

  async function loadStyleProfile() {
    setLoading(true);
    setError(null);
    try {
      const savedProfile = await getConfirmedStyleProfile();
      setStyleProfile(savedProfile);
      setDraftDisplayName(displayName ?? "");
      setDraftKeywords(savedProfile?.keywords ?? emptyProfileTags());
      setDraftPreferenceState(savedProfile?.preferenceState ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load your style profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStyleProfile();
  }, []);

  function cancelEditing() {
    const changed = draftDisplayName.trim() !== (displayName ?? "").trim()
      || !sameTags(draftKeywords, styleProfile?.keywords ?? emptyProfileTags())
      || Boolean(draftPreferenceState && styleProfile && !samePreferenceDecisions(draftPreferenceState, styleProfile.preferenceState));
    if (changed && !window.confirm("Discard your unsaved style changes?")) return;
    setDraftDisplayName(displayName ?? "");
    setDraftKeywords(styleProfile?.keywords ?? emptyProfileTags());
    setDraftPreferenceState(styleProfile?.preferenceState ?? null);
    setSaveError(null);
    setRefreshError(null);
  }

  function addTag(field: StyleTagField, value: string) {
    const result = addProfileTag(draftKeywords, field, value);
    if (result.error) return result.error;
    setDraftKeywords(result.tags);
    setDraftPreferenceState((current) => current ? {
      ...current,
      manualTags: mergeProfileTags(current.manualTags, oneTag(field, value)),
      dismissedTags: withoutProfileTag(current.dismissedTags, field, value),
    } : current);
    return null;
  }

  function removeTag(field: StyleTagField, value: string) {
    setDraftKeywords((current) => withoutProfileTag(current, field, value));
    setDraftPreferenceState((current) => current ? {
      ...current,
      manualTags: withoutProfileTag(current.manualTags, field, value),
      keptTags: withoutProfileTag(current.keptTags, field, value),
      dismissedTags: mergeProfileTags(current.dismissedTags, oneTag(field, value)),
    } : current);
  }

  function keepTag(field: StyleTagField, value: string) {
    setDraftPreferenceState((current) => current ? {
      ...current,
      keptTags: includesTag(current.keptTags, field, value)
        ? withoutProfileTag(current.keptTags, field, value)
        : mergeProfileTags(current.keptTags, oneTag(field, value)),
    } : current);
  }

  async function saveChanges() {
    if (!styleProfile || !draftPreferenceState) return;
    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    try {
      const nameChanged = draftDisplayName.trim() !== (displayName ?? "").trim();
      const tagsChanged = !sameTags(draftKeywords, styleProfile.keywords);
      const preferenceChanged = !samePreferenceDecisions(draftPreferenceState, styleProfile.preferenceState);
      if (!nameChanged && !tagsChanged && !preferenceChanged) {
        setSaveNotice("No changes made — profile saved.");
        return;
      }

      if (tagsChanged) {
        const normalized = normalizeStyleProfile(styleProfile.aesthetic, draftKeywords);
        const nextPreferenceState = { ...draftPreferenceState };
        await updateSavedStyleProfile(normalized.aesthetic, normalized.keywords, nextPreferenceState);
        setStyleProfile({
          ...styleProfile,
          aesthetic: normalized.aesthetic,
          keywords: normalized.keywords,
          preferenceState: nextPreferenceState,
          confirmed_at: new Date().toISOString(),
        });
        setDraftPreferenceState(nextPreferenceState);
      } else if (preferenceChanged) {
        const nextPreferenceState = { ...draftPreferenceState };
        await updateSavedStyleProfile(styleProfile.aesthetic, styleProfile.keywords, nextPreferenceState, false);
        setStyleProfile((current) => current ? { ...current, preferenceState: nextPreferenceState } : current);
        setDraftPreferenceState(nextPreferenceState);
      }
      if (nameChanged) await onSaveDisplayName(draftDisplayName);
      setSaveNotice("Your style profile is saved.");
    } catch (saveFailure) {
      setSaveError(saveFailure instanceof Error ? saveFailure.message : "Could not save your style changes.");
    } finally {
      setSaving(false);
    }
  }

  async function startRefresh() {
    if (!styleProfile || refreshLock.current) return;
    if (hasUnsavedChanges) {
      setRefreshError("Save your profile edits before refreshing preferences.");
      return;
    }
    if (!window.confirm("Refresh Profile Preferences will reanalyze your current saved inspiration photos and update the AI-generated aesthetic and tags. Your manually added, kept, and dismissed tags will be respected. Continue?")) return;

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
      setStyleProfile(nextProfile);
      setDraftKeywords(nextProfile.keywords);
      setDraftPreferenceState(nextPreferenceState);
      setRefreshNotice("Your updated style preferences are saved.");
    } catch (refreshFailure) {
      setRefreshError(refreshFailure instanceof Error ? refreshFailure.message : "Could not refresh profile preferences.");
    } finally {
      refreshLock.current = false;
      setRefreshing(false);
    }
  }

  const hasUnsavedChanges = Boolean(styleProfile) && (
    draftDisplayName.trim() !== (displayName ?? "").trim()
    || !sameTags(draftKeywords, styleProfile?.keywords ?? emptyProfileTags())
    || Boolean(draftPreferenceState && styleProfile && !samePreferenceDecisions(draftPreferenceState, styleProfile.preferenceState))
  );
  const headingName = draftDisplayName.trim();

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasUnsavedChanges]);

  return (
    <main className="progress-screen">
      <header className="app-header">
        <div className="wordmark"><span className="wordmark-mark">F</span> FITCHECK</div>
        <span className="app-header-label">STYLE PROFILE</span>
      </header>
      <section className="home-content">
        <div className="profile-title-row">
          <div>
            <p className="eyebrow">YOUR STYLE, IN FOCUS{headingName ? ` · ${headingName}` : ""}</p>
            <h1>{headingName ? `${headingName}'s Style Profile` : "Your Style Profile"}</h1>
          </div>
        </div>

        {loading ? <p className="flow-status" role="status">Loading your saved style profile...</p> : error ? (
          <div className="home-error"><p role="alert">{error}</p><button className="text-button" type="button" onClick={() => void loadStyleProfile()}>Try again</button></div>
        ) : styleProfile ? (
          <section className="profile-editor" aria-label="Style profile">
            <label className="display-name-field">Display name
              <input value={draftDisplayName} maxLength={60} disabled={saving || refreshing} onChange={(event) => setDraftDisplayName(event.target.value)} />
            </label>
            <div className="aesthetic-summary"><span className="eyebrow">Aesthetic</span><strong title={styleProfile.aesthetic}>{styleProfile.aesthetic}</strong></div>
            <div className="keyword-section">
              <div className="keyword-title"><span>Style tags</span><span>{profileTagCount(draftKeywords)} saved</span></div>
              <StyleTagList
                tags={draftKeywords}
                aiTags={draftPreferenceState?.aiTags}
                manualTags={draftPreferenceState?.manualTags}
                keptTags={draftPreferenceState?.keptTags}
                disabled={saving || refreshing}
                onRemove={removeTag}
                onAdd={addTag}
                onKeep={keepTag}
              />
            </div>
            {saveError && <p className="flow-error" role="alert">{saveError}</p>}
            <div className="review-bottom editor-actions">
              <button type="button" className="text-button" disabled={saving || refreshing} onClick={cancelEditing}>Cancel</button>
              <button type="button" className="primary-button" disabled={saving || refreshing || profileTagCount(draftKeywords) === 0} onClick={() => void saveChanges()}>{saving ? "Saving changes..." : "Save Changes"}<span aria-hidden="true">↗</span></button>
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

        {saveNotice && <p className="flow-status" role="status">{saveNotice}</p>}
        <PhotoLibrary compact />
        <div className="refresh-preferences refresh-preferences-after-photos">
          <div>
            <h2>Refresh Profile Preferences</h2>
            <p>Reanalyze your current saved inspiration photos to update the AI-generated aesthetic and tags. Manually added, kept, and dismissed tags are respected.</p>
          </div>
          {hasUnsavedChanges && <p className="limit-message">Save profile edits before refreshing preferences.</p>}
          {refreshNotice && <p className="flow-status" role="status">{refreshNotice}</p>}
          {refreshError && <p className="flow-error" role="alert">{refreshError}</p>}
          <button type="button" className="secondary-button" disabled={!styleProfile || loading || saving || refreshing || hasUnsavedChanges} onClick={() => void startRefresh()}>
            {refreshing ? "Refreshing preferences..." : "Refresh Profile Preferences"}<span aria-hidden="true">↻</span>
          </button>
        </div>
      </section>
    </main>
  );
}