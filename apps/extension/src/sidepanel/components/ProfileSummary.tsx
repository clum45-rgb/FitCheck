import type { StyleProfile } from "../../types";

type ProfileSummaryProps = {
  profile: StyleProfile;
  onEdit: () => void;
};

export function ProfileSummary({ profile, onEdit }: ProfileSummaryProps) {
  return (
    <section className="card" aria-labelledby="style-heading">
      <div className="section-heading">
        <h2 id="style-heading">Your style</h2>
        <button type="button" className="text-button" onClick={onEdit}>
          Edit style
        </button>
      </div>
      <dl className="style-list">
        <div>
          <dt>Aesthetic</dt>
          <dd>{profile.aesthetics.join(", ")}</dd>
        </div>
        <div>
          <dt>Favorite colors</dt>
          <dd>{profile.colors.join(", ")}</dd>
        </div>
        <div>
          <dt>Preferred fit</dt>
          <dd>{profile.fit}</dd>
        </div>
      </dl>
    </section>
  );
}
