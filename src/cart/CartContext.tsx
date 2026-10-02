import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiRecords } from "@/api";

/** Borrowing cart: members collect books, then submit all requests at once. */

interface CartState {
  bookIds: number[];
  add: (id: number) => void;
  remove: (id: number) => void;
  clear: () => void;
  has: (id: number) => boolean;
  submitAll: () => Promise<{ ok: number; failed: unknown[] }>;
}

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [bookIds, setBookIds] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("lb_cart") ?? "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("lb_cart", JSON.stringify(bookIds));
  }, [bookIds]);

  const add = (id: number) => setBookIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  const remove = (id: number) => setBookIds((ids) => ids.filter((x) => x !== id));
  const clear = () => setBookIds([]);
  const has = (id: number) => bookIds.includes(id);

  const submitAll = async () => {
    let ok = 0;
    const failed: unknown[] = [];
    for (const id of bookIds) {
      try {
        await apiRecords.create(id);
        ok += 1;
        setBookIds((ids) => ids.filter((x) => x !== id));
      } catch (e) {
        failed.push(e);
      }
    }
    return { ok, failed };
  };

  return (
    <CartContext.Provider value={{ bookIds, add, remove, clear, has, submitAll }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
