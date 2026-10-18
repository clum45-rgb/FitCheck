import { Settings } from "lucide-react";

type HeaderProps = {
  onOpenSettings?: () => void;
};

export function Header({ onOpenSettings }: HeaderProps) {
  return (
    <header className="header">
      <div className="brand">
        <h1>Fitspo</h1>
      </div>
      {onOpenSettings ? (
        <button type="button" className="icon-button" onClick={onOpenSettings} aria-label="Open settings">
          <Settings size={18} aria-hidden="true" />
        </button>
      ) : null}
    </header>
  );
}
