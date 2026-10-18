import { useState, type FormEvent } from "react";
import { MAX_PROFILE_TAG_LENGTH, MAX_PROFILE_TAGS_PER_CATEGORY, STYLE_TAG_FIELDS, normalizeProfileTagKey, type ProfileTags, type StyleTagField } from "../style-profile";

export const styleTagFieldLabels: Record<StyleTagField, string> = {
  category: "Category",
  fit: "Fit",
  color: "Color",
  material: "Material",
  aesthetic: "Aesthetics",
};

type StyleTagListProps = {
  tags: ProfileTags;
  onRemove?: (field: StyleTagField, value: string) => void;
  onAdd?: (field: StyleTagField, value: string) => string | null;
  onRequestAdd?: (field: StyleTagField) => void;
  onKeep?: (field: StyleTagField, value: string) => void;
  aiTags?: ProfileTags;
  manualTags?: ProfileTags;
  keptTags?: ProfileTags;
  disabled?: boolean;
};

export function StyleTagList({ tags, onRemove, onAdd, onRequestAdd, onKeep, aiTags, manualTags, keptTags, disabled = false }: StyleTagListProps) {
  const [draftValues, setDraftValues] = useState<Partial<Record<StyleTagField, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<StyleTagField, string>>>({});

  function submitTag(event: FormEvent<HTMLFormElement>, field: StyleTagField) {
    event.preventDefault();
    if (!onAdd) return;
    const error = onAdd(field, draftValues[field] ?? "");
    setErrors((current) => ({ ...current, [field]: error ?? undefined }));
    if (!error) setDraftValues((current) => ({ ...current, [field]: "" }));
  }

  return (
    <div className="tag-groups">
      {STYLE_TAG_FIELDS.map((field) => (
        <section key={field} aria-label={styleTagFieldLabels[field]}>
          <div className="keyword-title">
            <span className="keyword-label">
              {styleTagFieldLabels[field]}
              {onRequestAdd && (
                <button
                  type="button"
                  className="add-category-tag"
                  aria-label={`Add ${styleTagFieldLabels[field].toLowerCase()} tag`}
                  disabled={disabled || tags[field].length >= MAX_PROFILE_TAGS_PER_CATEGORY}
                  onClick={() => onRequestAdd(field)}
                >+</button>
              )}
            </span>
            {(onAdd || onRemove) && <span>{tags[field].length} / {MAX_PROFILE_TAGS_PER_CATEGORY}</span>}
          </div>
          {tags[field].length === 0 ? <p className="keyword-empty">None selected.</p> : (
            <ul className="keyword-list">
              {tags[field].map((value) => (
                <li key={value}>
                  <span>{value}</span>
                  {onKeep
                    && (aiTags?.[field].some((tag) => normalizeProfileTagKey(tag) === normalizeProfileTagKey(value))
                      || manualTags?.[field].some((tag) => normalizeProfileTagKey(tag) === normalizeProfileTagKey(value))) && (
                      <button
                        type="button"
                        className="keep-tag-button"
                        aria-label={`${keptTags?.[field].some((tag) => normalizeProfileTagKey(tag) === normalizeProfileTagKey(value)) ? "Stop keeping" : "Keep"} ${value}`}
                        aria-pressed={keptTags?.[field].some((tag) => normalizeProfileTagKey(tag) === normalizeProfileTagKey(value)) ?? false}
                        disabled={disabled}
                        onClick={() => onKeep(field, value)}
                      >
                        {keptTags?.[field].some((tag) => normalizeProfileTagKey(tag) === normalizeProfileTagKey(value)) ? "Kept" : "Keep"}
                      </button>
                    )}
                  {onRemove && (
                    <button type="button" className="remove-tag-button" aria-label={`Remove ${value}`} disabled={disabled} onClick={() => onRemove(field, value)}>×</button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {onAdd && (
            <form className="profile-tag-entry" onSubmit={(event) => submitTag(event, field)}>
              <label className="visually-hidden" htmlFor={`profile-tag-${field}`}>Add {styleTagFieldLabels[field].toLowerCase()} tag</label>
              <input
                id={`profile-tag-${field}`}
                value={draftValues[field] ?? ""}
                maxLength={MAX_PROFILE_TAG_LENGTH}
                disabled={disabled || tags[field].length >= MAX_PROFILE_TAGS_PER_CATEGORY}
                placeholder={`Add ${styleTagFieldLabels[field].toLowerCase()}`}
                onChange={(event) => setDraftValues((current) => ({ ...current, [field]: event.target.value }))}
              />
              <button type="submit" className="secondary-button" disabled={disabled || tags[field].length >= MAX_PROFILE_TAGS_PER_CATEGORY} aria-label={`Add ${styleTagFieldLabels[field].toLowerCase()} tag`}>Add <span aria-hidden="true">+</span></button>
              {errors[field] && <p className="tag-entry-error" role="alert">{errors[field]}</p>}
            </form>
          )}
        </section>
      ))}
    </div>
  );
}
