import { useContext } from 'react';
import { CartContext, CartContextValue } from '../context/CartContext';

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
