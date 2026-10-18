import { ShoppingBag } from "lucide-react";
import { ErrorNotice } from "./ErrorNotice";
import { ScanButton } from "./ScanButton";

type CurrentPageCardProps = {
  loading: boolean;
  errorMessage: string | null;
  onScan: () => void;
  onDismissError: () => void;
};

export function CurrentPageCard({ loading, errorMessage, onScan, onDismissError }: CurrentPageCardProps) {
  return (
    <section className="card" aria-labelledby="page-heading">
      <div className="page-context">
        <span className="page-icon" aria-hidden="true">
          <ShoppingBag size={18} />
        </span>
        <div>
          <p className="eyebrow">Current page</p>
          <h2 id="page-heading">Uniqlo</h2>
        </div>
      </div>
      <p className="muted">
        FitFinder will analyze the clothing on this page and look for pieces that match your style.
      </p>
      <ScanButton loading={loading} onScan={onScan} />
      {errorMessage ? (
        <div className="scan-feedback">
          <ErrorNotice message={errorMessage} onDismiss={onDismissError} />
          <button type="button" className="text-button" onClick={onScan} disabled={loading}>
            Retry
          </button>
        </div>
      ) : null}
    </section>
  );
}
