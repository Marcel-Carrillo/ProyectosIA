import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CartLineItem } from '../types/auth';

const STORAGE_KEY = 'storefront_cart';

interface CartContextValue {
  items: CartLineItem[];
  itemCount: number;
  addItem: (item: CartLineItem) => void;
  updateQuantity: (productVariantId: number, quantity: number) => void;
  removeItem: (productVariantId: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

function loadCart(): CartLineItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartLineItem[]) : [];
  } catch {
    return [];
  }
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartLineItem[]>(() => loadCart());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((item: CartLineItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productVariantId === item.productVariantId);
      if (existing) {
        return prev.map((i) =>
          i.productVariantId === item.productVariantId
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      return [...prev, item];
    });
  }, []);

  const updateQuantity = useCallback((productVariantId: number, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((i) => i.productVariantId !== productVariantId);
      return prev.map((i) => (i.productVariantId === productVariantId ? { ...i, quantity } : i));
    });
  }, []);

  const removeItem = useCallback((productVariantId: number) => {
    setItems((prev) => prev.filter((i) => i.productVariantId !== productVariantId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  const value = useMemo(
    () => ({ items, itemCount, addItem, updateQuantity, removeItem, clearCart }),
    [items, itemCount, addItem, updateQuantity, removeItem, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
