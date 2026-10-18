import type { ProductCardData } from "../../types";

type ProductCardProps = {
  product: ProductCardData;
  approved?: boolean;
  highlighted?: boolean;
  onView?: () => void;
  onApprove?: () => void;
  onRemove?: () => void;
};

export function ProductCard({
  product,
  approved = false,
  highlighted = false,
  onView,
  onApprove,
  onRemove,
}: ProductCardProps) {
  return (
    <article className={highlighted ? "product-card product-card-active" : "product-card"}>
      <img src={product.imageUrl} alt="" />
      <div className="product-copy">
        <h3>{product.name}</h3>
        <p>{product.price}</p>
        <p className="match-label">{product.matchLabel}</p>
        <div className="product-actions">
          {onView ? (
            <button type="button" className="text-button" onClick={onView}>
              View piece
            </button>
          ) : (
            <a href={product.url}>View piece</a>
          )}
        </div>
      </div>
      {approved ? (
        onRemove ? (
          <button type="button" className="button button-ghost product-side-action" onClick={onRemove}>
            Remove
          </button>
        ) : null
      ) : onApprove ? (
        <button type="button" className="button button-primary product-side-action" onClick={onApprove}>
          Add to cart
        </button>
      ) : null}
    </article>
  );
}
