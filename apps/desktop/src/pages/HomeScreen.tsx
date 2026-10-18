import { useEffect, useState } from "react";
import { PhotoLibrary } from "../onboarding/PhotoLibrary";
import { getConfirmedStyleProfile, normalizeStyleProfile, updateSavedStyleProfile, type ConfirmedStyleProfile } from "../onboarding/styleProfiles";

type HomeScreenProps = {
  displayName: string | null;
  onCompleteSetup: () => void;
};

export function HomeScreen({ displayName, onCompleteSetup }: HomeScreenProps) {
  const [styleProfile, setStyleProfile] = useState<ConfirmedStyleProfile | null>(null);
  const [draftAesthetic, setDraftAesthetic] = useState("");
  const [draftKeywords, setDraftKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
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
    setDraftKeywords(styleProfile?.keywords ?? []);
    setKeywordInput("");
    setSaveError(null);
    setSaveNotice(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    const changed = draftAesthetic !== (styleProfile?.aesthetic ?? "")
      || JSON.stringify(draftKeywords) !== JSON.stringify(styleProfile?.keywords ?? []);
    if (changed && !window.confirm("Discard your unsaved style changes?")) return;
    setDraftAesthetic(styleProfile?.aesthetic ?? "");
    setDraftKeywords(styleProfile?.keywords ?? []);
    setSaveError(null);
    setIsEditing(false);
  }

  function addKeyword() {
    const keyword = keywordInput.trim();
    if (!keyword || draftKeywords.some((item) => item.toLocaleLowerCase() === keyword.toLocaleLowerCase())) return;
    setDraftKeywords((current) => [...current, keyword]);
    setKeywordInput("");
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
                <div className="keyword-title"><span>Style keywords</span><span>{draftKeywords.length} selected</span></div>
                <ul className="keyword-list">
                  {draftKeywords.map((keyword) => (
                    <li key={keyword}><span>{keyword}</span><button type="button" aria-label={`Remove ${keyword}`} disabled={saving} onClick={() => setDraftKeywords((current) => current.filter((item) => item !== keyword))}>×</button></li>
                  ))}
                </ul>
                <form className="keyword-add-form" onSubmit={(event) => { event.preventDefault(); addKeyword(); }}>
                  <label className="visually-hidden" htmlFor="new-keyword">Add a style keyword</label>
                  <input id="new-keyword" value={keywordInput} maxLength={40} onChange={(event) => setKeywordInput(event.target.value)} placeholder="Add a keyword" disabled={saving} />
                  <button type="submit" className="secondary-button" disabled={saving || !keywordInput.trim()}>Add keyword <span aria-hidden="true">+</span></button>
                </form>
              </div>
              {saveError && <p className="flow-error" role="alert">{saveError}</p>}
              <div className="review-bottom editor-actions">
                <button type="button" className="text-button" disabled={saving} onClick={cancelEditing}>Cancel</button>
                <button type="button" className="primary-button" disabled={saving || !draftAesthetic.trim() || draftKeywords.every((keyword) => !keyword.trim())} onClick={() => void saveChanges()}>{saving ? "Saving changes..." : "Save Changes"}<span aria-hidden="true">↗</span></button>
              </div>
            </section>
          ) : (
            <section className="saved-style" aria-label="Confirmed style profile">
              <div className="saved-style-heading"><p className="eyebrow">CONFIRMED AESTHETIC</p><span className="saved-status">SAVED</span></div>
              <h2>{styleProfile.aesthetic}</h2>
              <p className="keyword-title saved-keyword-title">Style keywords <span>{styleProfile.keywords.length} saved</span></p>
              <ul className="saved-keywords">{styleProfile.keywords.map((keyword) => <li key={keyword}>{keyword}</li>)}</ul>
            </section>
          )
        ) : (
          <section className="profile-empty">
            <p className="eyebrow">No confirmed style yet</p>
            <h2>Start with the looks you love.</h2>
            <p>Complete the inspiration flow to save your aesthetic and style keywords here.</p>
            <button className="primary-button" type="button" onClick={onCompleteSetup}>Continue setup <span aria-hidden="true">↗</span></button>
          </section>
        )}

        {saveNotice && <p className="flow-status" role="status">{saveNotice}</p>}
        <PhotoLibrary compact />
      </section>
    </main>
  );
}