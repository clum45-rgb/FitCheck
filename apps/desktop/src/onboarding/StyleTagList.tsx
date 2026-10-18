import { STYLE_TAG_FIELDS, type StyleTagField, type StyleTags } from "../style-profile";

const labels: Record<StyleTagField, string> = {
  category: "Category",
  fit: "Fit",
  color: "Color",
  material: "Material",
  aesthetic: "Aesthetic",
};

type StyleTagListProps = {
  tags: StyleTags;
  onRemove?: (field: StyleTagField, value: string) => void;
  disabled?: boolean;
};

export function StyleTagList({ tags, onRemove, disabled = false }: StyleTagListProps) {
  return (
    <div className="tag-groups">
      {STYLE_TAG_FIELDS.map((field) => (
        <section key={field} aria-label={labels[field]}>
          <div className="keyword-title"><span>{labels[field]}</span><span>{tags[field].length} selected</span></div>
          {tags[field].length === 0 ? <p className="keyword-empty">None selected.</p> : (
            <ul className="keyword-list">
              {tags[field].map((value) => (
                <li key={value}>
                  <span>{value}</span>
                  {onRemove && (
                    <button type="button" aria-label={`Remove ${value}`} disabled={disabled} onClick={() => onRemove(field, value)}>×</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
