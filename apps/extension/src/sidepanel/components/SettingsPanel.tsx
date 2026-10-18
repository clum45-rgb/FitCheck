import { useEffect, useId, useRef, useState } from "react";
import { Images, Info, SlidersHorizontal, UserRound, X } from "lucide-react";
import { uploadInspirationPhotos } from "../../lib/placeholderActions";
import { ErrorNotice } from "./ErrorNotice";

type SettingsPanelProps = {
  onClose: () => void;
  onEditStyle: () => void;
};

export function SettingsPanel({ onClose, onEditStyle }: SettingsPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [notice, setNotice] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
  }, []);

  async function handlePhotos() {
    setShowAbout(false);
    setNotice(null);
    setPending(true);
    try {
      await uploadInspirationPhotos();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Photo uploads aren't available yet.";
      setNotice(message);
    } finally {
      setPending(false);
    }
  }

  function handleAccount() {
    setShowAbout(false);
    setPending(false);
    setNotice("Account settings aren't available yet. This feature will be connected in a future update.");
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
          <button type="button" className="settings-row" onClick={onEditStyle}>
            <SlidersHorizontal size={16} aria-hidden="true" />
            Edit style preferences
          </button>
          <button type="button" className="settings-row" onClick={handlePhotos} disabled={pending}>
            <Images size={16} aria-hidden="true" />
            Manage inspiration photos
          </button>
          <button type="button" className="settings-row" onClick={handleAccount} disabled={pending}>
            <UserRound size={16} aria-hidden="true" />
            Account settings
          </button>
          <button
            type="button"
            className="settings-row"
            aria-expanded={showAbout}
            onClick={() => {
              setNotice(null);
              setShowAbout((current) => !current);
            }}
          >
            <Info size={16} aria-hidden="true" />
            About FitFinder
          </button>
        </div>
        {showAbout ? (
          <p className="about">
            FitFinder is a prototype for finding clothes that match a saved style while you browse. Scanning,
            accounts, and photo uploads are not connected yet.
          </p>
        ) : null}
        {notice ? <ErrorNotice message={notice} onDismiss={() => setNotice(null)} /> : null}
      </div>
    </dialog>
  );
}
