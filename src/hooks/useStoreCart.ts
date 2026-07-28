import { useCallback, useEffect, useState } from "react";

const KEY = "loja_show_cart_v1";
const EVT = "loja_show_cart_updated";

export interface CartItem {
  item_id: string;
  slug: string;
  name: string;
  cost_points: number;
  main_image_url: string | null;
  quantity: number;
  stock_available: number;
  per_user_limit: number | null;
}

function read(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVT));
}

export function useStoreCart() {
  const [items, setItems] = useState<CartItem[]>(() => read());

  useEffect(() => {
    const sync = () => setItems(read());
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const addItem = useCallback((item: Omit<CartItem, "quantity">, qty = 1) => {
    const cur = read();
    const existing = cur.find(i => i.item_id === item.item_id);
    let next: CartItem[];
    if (existing) {
      const maxByStock = item.stock_available;
      const maxByUser = item.per_user_limit ?? Infinity;
      const newQty = Math.min(existing.quantity + qty, maxByStock, maxByUser);
      next = cur.map(i => i.item_id === item.item_id ? { ...i, quantity: newQty } : i);
    } else {
      next = [...cur, { ...item, quantity: Math.min(qty, item.stock_available, item.per_user_limit ?? Infinity) }];
    }
    write(next);
  }, []);

  const setQuantity = useCallback((item_id: string, qty: number) => {
    const cur = read();
    if (qty <= 0) {
      write(cur.filter(i => i.item_id !== item_id));
      return;
    }
    write(cur.map(i => {
      if (i.item_id !== item_id) return i;
      const maxByStock = i.stock_available;
      const maxByUser = i.per_user_limit ?? Infinity;
      return { ...i, quantity: Math.min(qty, maxByStock, maxByUser) };
    }));
  }, []);

  const removeItem = useCallback((item_id: string) => {
    write(read().filter(i => i.item_id !== item_id));
  }, []);

  const clearCart = useCallback(() => write([]), []);

  const totalPoints = items.reduce((n, i) => n + i.cost_points * i.quantity, 0);
  const totalItems = items.reduce((n, i) => n + i.quantity, 0);

  return { items, addItem, setQuantity, removeItem, clearCart, totalPoints, totalItems };
}
