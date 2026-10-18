import { useCart } from "../../cart/CartContext";
import { navigateCurrentTab } from "../../lib/placeholderActions";
import type { CartItem } from "../../types";
import { ProductCard } from "./ProductCard";

export function CartTab() {
  const { items, loading, error, remove } = useCart();

  function handleView(item: CartItem) {
    void navigateCurrentTab(item.url);
  }

  async function handleRemove(item: CartItem) {
    await remove(item.productId);
  }

  if (loading) {
    return <p className="muted" role="status">Loading your cart...</p>;
  }

  if (error) {
    return (
      <section className="card">
        <p className="eyebrow">Cart unavailable</p>
        <h2>We couldn't load your cart.</h2>
        <p className="muted">{error}</p>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="card">
        <p className="eyebrow">Cart</p>
        <h2>Nothing approved yet.</h2>
        <p className="muted">Matches you approve on the Scan tab will show up here.</p>
      </section>
    );
  }

  return (
    <section className="card recommendations" aria-labelledby="cart-heading">
      <h2 id="cart-heading">Your cart</h2>
      <div className="product-list">
        {items.map((item) => (
          <ProductCard
            key={item.productId}
            product={{
              name: item.name,
              imageUrl: item.imageUrl,
              price: item.price || "—",
              url: item.url,
              matchLabel: "In your cart",
            }}
            approved
            onView={() => handleView(item)}
            onRemove={() => {
              void handleRemove(item);
            }}
          />
        ))}
      </div>
    </section>
  );
}
