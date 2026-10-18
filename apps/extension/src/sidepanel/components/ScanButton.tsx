import { LoaderCircle } from "lucide-react";

type ScanButtonProps = {
  loading: boolean;
  onScan: () => void;
};

export function ScanButton({ loading, onScan }: ScanButtonProps) {
  return (
    <button type="button" className="button button-primary" onClick={onScan} disabled={loading} aria-busy={loading}>
      {loading ? <LoaderCircle size={16} className="spinner" aria-hidden="true" /> : null}
      {loading ? "Scanning…" : "Scan This Page"}
    </button>
  );
}
