import { useCallback, useEffect, useState } from "react";
import { fetchCartItems, removeCartItem, type CartItem } from "../lib/cartApi";

type CartScreenProps = {
  accessToken: string;
};

function formatSavedDate(approvedAt: string | undefined) {
  if (!approvedAt) return null;
  const parsed = Date.parse(approvedAt);
  if (Number.isNaN(parsed)) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function retailerLabel(storeDomain: string) {
  return storeDomain.replace(/^www\./i, "");
}

export function CartScreen({ accessToken }: CartScreenProps) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRemoveError(null);
    try {
      setItems(await fetchCartItems(accessToken));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load your cart.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  async function handleRemove(item: CartItem) {
    setRemovingId(item.productId);
    setRemoveError(null);
    try {
      setItems(await removeCartItem(accessToken, item.productId));
    } catch (removeFailure) {
      setRemoveError(removeFailure instanceof Error ? removeFailure.message : "Could not remove this item.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="cart-content" aria-labelledby="cart-heading">
      <div className="cart-title-row">
        <div>
          <p className="eyebrow">FROM THE EXTENSION</p>
          <h1 id="cart-heading">Cart</h1>
          <p className="cart-intro">Pieces you approve in the Fitspo extension show up here so you can reopen or remove them.</p>
        </div>
        {!loading && !error ? (
          <p className="cart-count" aria-live="polite">
            <strong>{items.length}</strong>
            <span>{items.length === 1 ? " piece" : " pieces"}</span>
          </p>
        ) : null}
      </div>

      {loading ? (
        <p className="flow-status" role="status">Loading your cart...</p>
      ) : error ? (
        <div className="home-error">
          <p role="alert">{error}</p>
          <button className="text-button" type="button" onClick={() => void loadItems()}>Try again</button>
        </div>
      ) : items.length === 0 ? (
        <section className="cart-empty">
          <p className="eyebrow">Nothing in your cart yet</p>
          <h2>Your cart is empty.</h2>
          <p>Items you add from the Fitspo extension will appear here.</p>
        </section>
      ) : (
        <>
          {removeError ? <p className="flow-error" role="alert">{removeError}</p> : null}
          <ul className="cart-list">
            {items.map((item) => {
              const savedOn = formatSavedDate(item.approvedAt);
              const busy = removingId === item.productId;
              return (
                <li key={item.productId} className="cart-card">
                  <div className="cart-card-media" aria-hidden={item.imageUrl ? undefined : true}>
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" />
                    ) : (
                      <div className="cart-card-placeholder">No image</div>
                    )}
                  </div>
                  <div className="cart-card-body">
                    <div className="cart-card-copy">
                      <p className="cart-card-retailer">{retailerLabel(item.storeDomain)}</p>
                      <h2 className="cart-card-title">{item.name}</h2>
                      <p className="cart-card-price">{item.price?.trim() ? item.price : "Price unavailable"}</p>
                      {savedOn ? <p className="cart-card-date">Added {savedOn}</p> : null}
                    </div>
                    <div className="cart-card-actions">
                      <a
                        className="secondary-button cart-open-link"
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open product <span aria-hidden="true">↗</span>
                      </a>
                      <button
                        type="button"
                        className="text-button"
                        disabled={busy || removingId !== null}
                        onClick={() => void handleRemove(item)}
                      >
                        {busy ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
