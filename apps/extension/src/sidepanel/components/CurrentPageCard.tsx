import { ErrorNotice } from "./ErrorNotice";
import { ScanButton } from "./ScanButton";

type CurrentPageCardProps = {
  pageName: string;
  loading: boolean;
  errorMessage: string | null;
  onScan: () => void;
  onDismissError: () => void;
};

export function CurrentPageCard({ pageName, loading, errorMessage, onScan, onDismissError }: CurrentPageCardProps) {
  return (
    <section className="card" aria-labelledby="page-heading">
      <div className="page-context">
        <div>
          <p className="eyebrow">Current page</p>
          <h2 id="page-heading">{pageName}</h2>
        </div>
      </div>
      <p className="muted">
        Fitspo will analyze the clothing on this page and look for pieces that match your style.
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
