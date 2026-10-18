import { useEffect, useId, useRef, useState } from "react";
import { Info, LogOut, UserRound, X } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";
import { openWebApp } from "../../lib/webApp";

type SettingsPanelProps = {
  onClose: () => void;
};

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { signOut } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [showAbout, setShowAbout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
  }, []);

  function openAccount() {
    if (loggingOut) return;
    onClose();
    void openWebApp();
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      const result = await signOut();
      if (result.error) {
        setLogoutError(result.error);
        return;
      }
      onClose();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Could not log out.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => {
        if (loggingOut) {
          event.preventDefault();
          return;
        }
        onClose();
      }}
    >
      <div className="dialog-body">
        <div className="section-heading">
          <h2 id={titleId}>Settings</h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close settings"
            disabled={loggingOut}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="settings-list">
          <button type="button" className="settings-row" onClick={openAccount} disabled={loggingOut}>
            <UserRound size={16} aria-hidden="true" />
            Account settings
          </button>
          <button
            type="button"
            className="settings-row"
            aria-expanded={showAbout}
            onClick={() => setShowAbout((current) => !current)}
            disabled={loggingOut}
          >
            <Info size={16} aria-hidden="true" />
            About Fitspo
          </button>
          <button
            type="button"
            className="settings-row settings-row-danger"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
          >
            <LogOut size={16} aria-hidden="true" />
            {loggingOut ? "Logging out..." : "Log out"}
          </button>
        </div>
        {logoutError ? <p className="settings-error" role="alert">{logoutError}</p> : null}
        {showAbout ? (
          <p className="about">
            Fitspo finds clothes that match your saved style while you browse. Style and photo changes happen on the Fitspo website.
          </p>
        ) : null}
      </div>
    </dialog>
  );
}
