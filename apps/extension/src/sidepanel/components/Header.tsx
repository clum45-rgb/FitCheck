import { Settings, Shirt } from "lucide-react";

type HeaderProps = {
  onOpenSettings?: () => void;
};

export function Header({ onOpenSettings }: HeaderProps) {
  return (
    <header className="header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <Shirt size={18} />
        </span>
        <div>
          <h1>Fitspo</h1>
          <p className="prototype">Prototype</p>
        </div>
      </div>
      {onOpenSettings ? (
        <button type="button" className="icon-button" onClick={onOpenSettings} aria-label="Open settings">
          <Settings size={18} aria-hidden="true" />
        </button>
      ) : null}
    </header>
  );
}
