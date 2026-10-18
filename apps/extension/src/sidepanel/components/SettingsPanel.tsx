import { useEffect, useId, useRef, useState } from "react";
import { Info, UserRound, X } from "lucide-react";
import { openWebApp } from "../../lib/webApp";

type SettingsPanelProps = {
  onClose: () => void;
};

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
  }, []);

  function openAccount() {
    onClose();
    void openWebApp();
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={onClose}
    >
      <div className="dialog-body">
        <div className="section-heading">
          <h2 id={titleId}>Settings</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close settings">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="settings-list">
          <button type="button" className="settings-row" onClick={openAccount}>
            <UserRound size={16} aria-hidden="true" />
            Account settings
          </button>
          <button
            type="button"
            className="settings-row"
            aria-expanded={showAbout}
            onClick={() => setShowAbout((current) => !current)}
          >
            <Info size={16} aria-hidden="true" />
            About FitFinder
          </button>
        </div>
        {showAbout ? (
          <p className="about">
            FitFinder finds clothes that match your saved style while you browse. Style and photo changes happen on the FitCheck website.
          </p>
        ) : null}
      </div>
    </dialog>
  );
}
