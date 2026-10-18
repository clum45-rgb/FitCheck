import { useEffect, useId, useRef, useState } from "react";
import { Images, Info, SlidersHorizontal, UserRound, X } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import { uploadInspirationPhotos } from "../../lib/placeholderActions";
import { ErrorNotice } from "./ErrorNotice";

type SettingsPanelProps = {
  onClose: () => void;
  onEditStyle: () => void;
};

export function SettingsPanel({ onClose, onEditStyle }: SettingsPanelProps) {
  const { session, signOut } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [notice, setNotice] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
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

  async function handleSignOut() {
    setNotice(null);
    setPending(true);
    try {
      const result = await signOut();
      if (result.error) setNotice(result.error);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Sign out failed. Try again.");
    } finally {
      setPending(false);
    }
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
          <button
            type="button"
            className="settings-row"
            aria-expanded={showAccount}
            onClick={() => {
              setNotice(null);
              setShowAbout(false);
              setShowAccount((current) => !current);
            }}
            disabled={pending}
          >
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
        {showAccount ? (
          <div className="account-panel">
            <p className="muted">Signed in as {session?.user.email ?? "your FitCheck account"}.</p>
            <button className="button button-ghost" type="button" onClick={() => void handleSignOut()} disabled={pending}>
              {pending ? "Signing out..." : "Sign out"}
            </button>
          </div>
        ) : null}
        {showAbout ? (
          <p className="about">
            FitFinder finds clothes that match your saved style while you browse. Photo uploads are not connected yet.
          </p>
        ) : null}
        {notice ? <ErrorNotice message={notice} onDismiss={() => setNotice(null)} /> : null}
      </div>
    </dialog>
  );
}
