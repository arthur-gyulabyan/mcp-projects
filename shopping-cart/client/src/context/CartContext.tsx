import { createContext, useReducer, useCallback, ReactNode } from 'react';
import { Cart, CartDetails } from '../api/types';
import { cartApi } from '../api/cartApi';

interface CartState {
  cart: CartDetails | null;
  loading: boolean;
  error: string | null;
}

type CartAction =
  | { type: 'SET_LOADING' }
  | { type: 'SET_CART'; cart: CartDetails }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'CLEAR_CART' };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'SET_LOADING': return { ...state, loading: true, error: null };
    case 'SET_CART': return { cart: action.cart, loading: false, error: null };
    case 'SET_ERROR': return { ...state, loading: false, error: action.error };
    case 'CLEAR_CART': return { cart: null, loading: false, error: null };
  }
}

export interface CartContextValue {
  cart: CartDetails | null;
  loading: boolean;
  error: string | null;
  createCart: (customerId: string) => Promise<void>;
  refreshCart: () => Promise<void>;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>;
  removeItem: (cartItemId: string) => Promise<void>;
  applyCoupon: (couponCode: string) => Promise<void>;
  checkout: () => Promise<void>;
  clearError: () => void;
}

export const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { cart: null, loading: false, error: null });

  const refreshCart = useCallback(async () => {
    if (!state.cart) return;
    try {
      dispatch({ type: 'SET_LOADING' });
      const cart = await cartApi.getCartById(state.cart.id);
      dispatch({ type: 'SET_CART', cart });
    } catch (e: any) {
      dispatch({ type: 'SET_ERROR', error: e.message });
    }
  }, [state.cart?.id]);

  const createCart = useCallback(async (customerId: string) => {
    try {
      dispatch({ type: 'SET_LOADING' });
      const created = await cartApi.createCart(customerId);
      const cart = await cartApi.getCartById(created.id);
      dispatch({ type: 'SET_CART', cart });
    } catch (e: any) {
      dispatch({ type: 'SET_ERROR', error: e.message });
    }
  }, []);

  const addItem = useCallback(async (productId: string, quantity = 1) => {
    if (!state.cart) return;
    try {
      dispatch({ type: 'SET_LOADING' });
      await cartApi.addItemToCart(state.cart.id, productId, quantity);
      const cart = await cartApi.getCartById(state.cart.id);
      dispatch({ type: 'SET_CART', cart });
    } catch (e: any) {
      dispatch({ type: 'SET_ERROR', error: e.message });
    }
  }, [state.cart?.id]);

  const updateQuantity = useCallback(async (cartItemId: string, quantity: number) => {
    if (!state.cart) return;
    try {
      dispatch({ type: 'SET_LOADING' });
      await cartApi.updateItemQuantity(state.cart.id, cartItemId, quantity);
      const cart = await cartApi.getCartById(state.cart.id);
      dispatch({ type: 'SET_CART', cart });
    } catch (e: any) {
      dispatch({ type: 'SET_ERROR', error: e.message });
    }
  }, [state.cart?.id]);

  const removeItem = useCallback(async (cartItemId: string) => {
    if (!state.cart) return;
    try {
      dispatch({ type: 'SET_LOADING' });
      await cartApi.removeItemFromCart(state.cart.id, cartItemId);
      const cart = await cartApi.getCartById(state.cart.id);
      dispatch({ type: 'SET_CART', cart });
    } catch (e: any) {
      dispatch({ type: 'SET_ERROR', error: e.message });
    }
  }, [state.cart?.id]);

  const applyCoupon = useCallback(async (couponCode: string) => {
    if (!state.cart) return;
    try {
      dispatch({ type: 'SET_LOADING' });
      await cartApi.applyCoupon(state.cart.id, couponCode);
      const cart = await cartApi.getCartById(state.cart.id);
      dispatch({ type: 'SET_CART', cart });
    } catch (e: any) {
      dispatch({ type: 'SET_ERROR', error: e.message });
    }
  }, [state.cart?.id]);

  const checkout = useCallback(async () => {
    if (!state.cart) return;
    try {
      dispatch({ type: 'SET_LOADING' });
      await cartApi.checkoutCart(state.cart.id);
      const cart = await cartApi.getCartById(state.cart.id);
      dispatch({ type: 'SET_CART', cart });
    } catch (e: any) {
      dispatch({ type: 'SET_ERROR', error: e.message });
    }
  }, [state.cart?.id]);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_CART', cart: state.cart! });
  }, [state.cart]);

  return (
    <CartContext.Provider value={{
      cart: state.cart,
      loading: state.loading,
      error: state.error,
      createCart,
      refreshCart,
      addItem,
      updateQuantity,
      removeItem,
      applyCoupon,
      checkout,
      clearError,
    }}>
      {children}
    </CartContext.Provider>
  );
}
