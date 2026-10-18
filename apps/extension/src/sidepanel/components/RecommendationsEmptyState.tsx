import { Shirt, Sparkles } from "lucide-react";

export function RecommendationsEmptyState() {
  return (
    <section className="card recommendations" aria-labelledby="recommendations-heading">
      <span className="empty-icon" aria-hidden="true">
        <Sparkles size={18} />
      </span>
      <h2 id="recommendations-heading">Your next favorite find starts here.</h2>
      <p className="muted">Scan a clothing page to discover pieces that match your style.</p>
      <div className="card-hints" aria-hidden="true">
        <div className="card-hint">
          <Shirt size={28} strokeWidth={1.5} />
        </div>
        <div className="card-hint">
          <Shirt size={28} strokeWidth={1.5} />
        </div>
      </div>
    </section>
  );
}
