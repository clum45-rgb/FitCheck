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
  const media = (
    <>
      <img src={product.imageUrl} alt="" />
      <div className="product-copy">
        <h3>{product.name}</h3>
        <p>{product.price}</p>
        <p className={product.matchLabel === "Great match" ? "match-label match-label-great" : "match-label"}>{product.matchLabel}</p>
      </div>
    </>
  );

  return (
    <article className={highlighted ? "product-card product-card-active" : "product-card"}>
      {onView ? (
        <button type="button" className="product-card-hit" onClick={onView} aria-label={`View ${product.name}`}>
          {media}
        </button>
      ) : (
        <a className="product-card-hit" href={product.url} aria-label={`View ${product.name}`}>
          {media}
        </a>
      )}
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
