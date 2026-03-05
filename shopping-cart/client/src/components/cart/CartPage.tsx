import { useCart } from '../../hooks/useCart';
import { CartItemRow } from './CartItemRow';
import { CartSummary } from './CartSummary';

export function CartPage() {
  const { cart, error } = useCart();

  if (!cart || cart.cartItems.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <h2 style={{ fontSize: 24, marginBottom: 8 }}>Your cart is empty</h2>
        <p style={{ color: 'var(--color-text-muted)' }}>Browse products and add items to get started.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Your Cart</h1>
      {error && <div className="error-banner">{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32, alignItems: 'start' }}>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '0 20px' }}>
          {cart.cartItems.map(item => (
            <CartItemRow key={item.id} item={item} />
          ))}
        </div>
        <CartSummary />
      </div>
    </div>
  );
}
