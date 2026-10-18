import { Pencil } from "lucide-react";
import type { StyleTagGroup } from "../../lib/savedProfile";

type ProfileSummaryProps = {
  aesthetic: string;
  tags: StyleTagGroup[];
  onEdit: () => void;
};

export function ProfileSummary({ aesthetic, tags, onEdit }: ProfileSummaryProps) {
  return (
    <section className="card" aria-labelledby="style-heading">
      <div className="section-heading">
        <h2 id="style-heading">Your style</h2>
        <button type="button" className="icon-button" onClick={onEdit} aria-label="Edit style on Fitspo">
          <Pencil size={16} aria-hidden="true" />
        </button>
      </div>
      {aesthetic || tags.length > 0 ? (
        <>
          {aesthetic ? <p className="style-title">{aesthetic}</p> : null}
          {tags.length > 0 ? (
            <dl className="style-list">
              {tags.map((group) => (
                <div key={group.label}>
                  <dt>{group.label}</dt>
                  <dd>{group.values.join(", ")}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </>
      ) : (
        <p className="muted">No saved style yet. Edit it on the Fitspo website.</p>
      )}
    </section>
  );
}
