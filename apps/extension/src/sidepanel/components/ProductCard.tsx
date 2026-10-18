import type { ProductCardData } from "../../types";

type ProductCardProps = {
  product: ProductCardData;
};

export function ProductCard({ product }: ProductCardProps) {
  return (
    <article className="product-card">
      <img src={product.imageUrl} alt="" />
      <div className="product-copy">
        <h3>{product.name}</h3>
        <p>{product.price}</p>
        <p className="match-label">{product.matchLabel}</p>
        <a href={product.url}>View piece</a>
      </div>
    </article>
  );
}
