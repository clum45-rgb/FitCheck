import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { loadSavedProfile, type SavedProfile } from "../../lib/savedProfile";
import { openWebApp } from "../../lib/webApp";
import { ProfileSummary } from "./ProfileSummary";

export function ProfileTab() {
  const [profile, setProfile] = useState<SavedProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const nextProfile = await loadSavedProfile();
        if (active) setProfile(nextProfile);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load your profile.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p className="muted" role="status">Loading your profile...</p>;
  }

  if (error || !profile) {
    return (
      <section className="card">
        <p className="eyebrow">Profile unavailable</p>
        <h2>We couldn't load your style.</h2>
        <p className="muted">{error ?? "Try again in a moment."}</p>
      </section>
    );
  }

  return (
    <>
      <ProfileSummary aesthetic={profile.style?.aesthetic ?? ""} tags={profile.style?.tags ?? []} onEdit={() => void openWebApp()} />
      <section className="card" aria-labelledby="photos-heading">
        <div className="section-heading">
          <h2 id="photos-heading">Inspiration photos</h2>
          <button type="button" className="icon-button" onClick={() => void openWebApp()} aria-label="Edit inspiration photos on FitCheck">
            <Pencil size={16} aria-hidden="true" />
          </button>
        </div>
        {profile.photos.length > 0 ? (
          <div className="photo-grid">
            {profile.photos.map((photo, index) => (
              <img key={photo.id} src={photo.url} alt={`Inspiration photo ${index + 1}`} />
            ))}
          </div>
        ) : (
          <p className="muted">No inspiration photos yet. Add them on the FitCheck website.</p>
        )}
      </section>
    </>
  );
}
