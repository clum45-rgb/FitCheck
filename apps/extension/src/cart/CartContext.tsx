import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../auth/AuthProvider";
import { approveMatch, fetchCart, removeFromCart } from "../lib/placeholderActions";
import type { CartItem, Match } from "../types";

type CartContextValue = {
  items: CartItem[];
  loading: boolean;
  error: string | null;
  isApproved: (productId: string) => boolean;
  approve: (match: Match) => Promise<void>;
  remove: (productId: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

// Single source of truth for cart state, shared by the Scan tab (which needs
// to know what's already approved) and the Cart tab (which lists it). Both
// read/write through this instead of keeping their own copies, so an action
// in one tab is immediately reflected in the other.
export function CartProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const nextItems = await fetchCart(session.access_token);
      setItems(nextItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your cart.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const approve = useCallback(
    async (match: Match) => {
      if (!session) return;
      await approveMatch(session.access_token, match);
      setItems((prev) => [
        ...prev.filter((item) => item.productId !== match.productId),
        {
          productId: match.productId,
          name: match.name,
          imageUrl: match.imageUrl,
          price: match.price,
          url: match.url,
          storeDomain: match.storeDomain,
        },
      ]);
    },
    [session],
  );

  const remove = useCallback(
    async (productId: string) => {
      if (!session) return;
      await removeFromCart(session.access_token, productId);
      setItems((prev) => prev.filter((item) => item.productId !== productId));
    },
    [session],
  );

  const isApproved = useCallback((productId: string) => items.some((item) => item.productId === productId), [items]);

  const value = useMemo<CartContextValue>(
    () => ({ items, loading, error, isApproved, approve, remove, refresh }),
    [items, loading, error, isApproved, approve, remove, refresh],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used within CartProvider.");
  return value;
}
