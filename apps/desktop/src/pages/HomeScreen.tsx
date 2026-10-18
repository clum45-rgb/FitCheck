import { useState, useEffect } from "react";
import { PhotoLibrary } from "../onboarding/PhotoLibrary";
import { StyleTagList } from "../onboarding/StyleTagList";
import { getConfirmedStyleProfile, normalizeStyleProfile, updateSavedStyleProfile, type ConfirmedStyleProfile } from "../onboarding/styleProfiles";
import { STYLE_TAG_FIELDS, STYLE_TAG_VOCAB, coerceStyleTags, emptyStyleTags, styleTagCount, withoutStyleTag, type StyleTagField, type StyleTags } from "../style-profile";

type HomeScreenProps = {
  displayName: string | null;
  onCompleteSetup: () => void;
};

export function HomeScreen({ displayName, onCompleteSetup }: HomeScreenProps) {
  const [styleProfile, setStyleProfile] = useState<ConfirmedStyleProfile | null>(null);
  const [draftAesthetic, setDraftAesthetic] = useState("");
  const [draftKeywords, setDraftKeywords] = useState<StyleTags>(emptyStyleTags);
  const [addField, setAddField] = useState<StyleTagField>("category");
  const [addValue, setAddValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

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

  function startEditing() {
    setDraftAesthetic(styleProfile?.aesthetic ?? "");
    setDraftKeywords(styleProfile?.keywords ?? emptyStyleTags());
    setAddValue("");
    setSaveError(null);
    setSaveNotice(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    const changed = draftAesthetic !== (styleProfile?.aesthetic ?? "")
      || JSON.stringify(draftKeywords) !== JSON.stringify(styleProfile?.keywords ?? []);
    if (changed && !window.confirm("Discard your unsaved style changes?")) return;
    setDraftAesthetic(styleProfile?.aesthetic ?? "");
    setDraftKeywords(styleProfile?.keywords ?? emptyStyleTags());
    setSaveError(null);
    setIsEditing(false);
  }

  const addOptions = (STYLE_TAG_VOCAB[addField] as readonly string[]).filter(
    (value) => !(draftKeywords[addField] as readonly string[]).includes(value),
  );

  function addTag() {
    if (!addOptions.includes(addValue)) return;
    setDraftKeywords((current) => coerceStyleTags({
      ...current,
      [addField]: [...current[addField], addValue],
    }));
    setAddValue("");
  }

  async function saveChanges() {
    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    try {
      const normalized = normalizeStyleProfile(draftAesthetic, draftKeywords);
      await updateSavedStyleProfile(normalized.aesthetic, normalized.keywords);
      setStyleProfile({
        aesthetic: normalized.aesthetic,
        keywords: normalized.keywords,
        confirmed_at: new Date().toISOString(),
      });
      setIsEditing(false);
      setSaveNotice("Your style profile is saved.");
    } catch (saveFailure) {
      setSaveError(saveFailure instanceof Error ? saveFailure.message : "Could not save your style changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="progress-screen">
      <header className="app-header">
        <div className="wordmark"><span className="wordmark-mark">F</span> FITCHECK</div>
        <span className="app-header-label">MY STYLE PROFILE</span>
      </header>
      <section className="home-content">
        <div className="profile-title-row">
          <div>
            <p className="eyebrow">YOUR STYLE, IN FOCUS{displayName ? ` · ${displayName}` : ""}</p>
            <h1>My Style Profile</h1>
          </div>
          {styleProfile && !isEditing && <button className="secondary-button" type="button" onClick={startEditing}>Edit Profile <span aria-hidden="true">↗</span></button>}
        </div>

        {loading ? <p className="flow-status" role="status">Loading your saved style profile...</p> : error ? (
          <div className="home-error"><p role="alert">{error}</p><button className="text-button" type="button" onClick={() => void loadStyleProfile()}>Try again</button></div>
        ) : styleProfile ? (
          isEditing ? (
            <section className="profile-editor" aria-label="Edit style profile">
              <label className="aesthetic-field">Aesthetic
                <input value={draftAesthetic} onChange={(event) => setDraftAesthetic(event.target.value)} aria-label="Edit aesthetic" />
              </label>
              <div className="keyword-section">
                <div className="keyword-title"><span>Style tags</span><span>{styleTagCount(draftKeywords)} selected</span></div>
                <StyleTagList tags={draftKeywords} disabled={saving} onRemove={(field, value) => setDraftKeywords((current) => withoutStyleTag(current, field, value))} />
                <form className="keyword-add-form" onSubmit={(event) => { event.preventDefault(); addTag(); }}>
                  <label className="visually-hidden" htmlFor="tag-field">Tag field</label>
                  <select id="tag-field" value={addField} disabled={saving} onChange={(event) => { setAddField(event.target.value as StyleTagField); setAddValue(""); }}>
                    {STYLE_TAG_FIELDS.map((field) => <option key={field} value={field}>{field}</option>)}
                  </select>
                  <label className="visually-hidden" htmlFor="tag-value">Tag value</label>
                  <select id="tag-value" value={addValue} disabled={saving || addOptions.length === 0} onChange={(event) => setAddValue(event.target.value)}>
                    <option value="">Select a tag</option>
                    {addOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                  <button type="submit" className="secondary-button" disabled={saving || !addValue}>Add tag <span aria-hidden="true">+</span></button>
                </form>
              </div>
              {saveError && <p className="flow-error" role="alert">{saveError}</p>}
              <div className="review-bottom editor-actions">
                <button type="button" className="text-button" disabled={saving} onClick={cancelEditing}>Cancel</button>
                <button type="button" className="primary-button" disabled={saving || !draftAesthetic.trim() || styleTagCount(draftKeywords) === 0} onClick={() => void saveChanges()}>{saving ? "Saving changes..." : "Save Changes"}<span aria-hidden="true">↗</span></button>
              </div>
            </section>
          ) : (
            <section className="saved-style" aria-label="Confirmed style profile">
              <div className="saved-style-heading"><p className="eyebrow">CONFIRMED AESTHETIC</p><span className="saved-status">SAVED</span></div>
              <h2>{styleProfile.aesthetic}</h2>
              <p className="keyword-title saved-keyword-title">Style tags <span>{styleTagCount(styleProfile.keywords)} saved</span></p>
              <StyleTagList tags={styleProfile.keywords} />
            </section>
          )
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
      </section>
    </main>
  );
}