import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import type { StyleProfile } from "../../types";

const aestheticOptions = ["Minimalist", "Streetwear", "Classic", "Tailoring", "Outdoor"];
const colorOptions = ["Black", "White", "Grey", "Navy", "Brown", "Olive"];
const fitOptions = ["Oversized", "Relaxed", "Regular", "Tailored"];

type StylePreferencesModalProps = {
  profile: StyleProfile;
  onClose: () => void;
  onSave: (profile: StyleProfile) => void;
};

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function StylePreferencesModal({ profile, onClose, onSave }: StylePreferencesModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [draft, setDraft] = useState<StyleProfile>(profile);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={onClose}
    >
      <form
        className="dialog-body"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
        <div className="section-heading">
          <h2 id={titleId}>Edit style</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close style editor">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <fieldset>
          <legend>Aesthetic</legend>
          <div className="chip-row">
            {aestheticOptions.map((option) => {
              const selected = draft.aesthetics.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  className={selected ? "chip chip-selected" : "chip"}
                  aria-pressed={selected}
                  onClick={() =>
                    setDraft((current) => ({ ...current, aesthetics: toggleValue(current.aesthetics, option) }))
                  }
                >
                  {option}
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend>Favorite colors</legend>
          <div className="chip-row">
            {colorOptions.map((option) => {
              const selected = draft.colors.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  className={selected ? "chip chip-selected" : "chip"}
                  aria-pressed={selected}
                  onClick={() =>
                    setDraft((current) => ({ ...current, colors: toggleValue(current.colors, option) }))
                  }
                >
                  {option}
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend>Preferred fit</legend>
          <div className="chip-row" role="radiogroup" aria-label="Preferred fit">
            {fitOptions.map((option) => {
              const selected = draft.fit === option;
              return (
                <button
                  key={option}
                  type="button"
                  className={selected ? "chip chip-selected" : "chip"}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setDraft((current) => ({ ...current, fit: option }))}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="dialog-actions">
          <button type="button" className="button button-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button-primary button-inline">
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}
