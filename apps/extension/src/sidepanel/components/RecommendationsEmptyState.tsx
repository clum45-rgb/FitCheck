import { Shirt } from "lucide-react";

export function RecommendationsEmptyState() {
  return (
    <div className="card-hints" aria-hidden="true">
      <div className="card-hint">
        <Shirt size={28} strokeWidth={1.5} />
      </div>
      <div className="card-hint">
        <Shirt size={28} strokeWidth={1.5} />
      </div>
    </div>
  );
}
