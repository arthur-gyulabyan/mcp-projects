import { useNavigate } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';
import { CouponInput } from './CouponInput';

export function CartSummary() {
  const { cart, checkout, loading } = useCart();
  const navigate = useNavigate();

  if (!cart) return null;

  const handleCheckout = async () => {
    await checkout();
    navigate('/checkout');
  };

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius)',
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <h3 style={{ fontSize: 18, fontWeight: 700 }}>Order Summary</h3>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Subtotal</span>
        <span>${cart.subtotal.toFixed(2)}</span>
      </div>

      {cart.discount > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-success)' }}>
          <span>Discount</span>
          <span>-${cart.discount.toFixed(2)}</span>
        </div>
      )}

      <div style={{
        display: 'flex', justifyContent: 'space-between',
        borderTop: '1px solid var(--color-border)',
        paddingTop: 16, fontSize: 18, fontWeight: 700,
      }}>
        <span>Total</span>
        <span>${cart.totalAmount.toFixed(2)}</span>
      </div>

      <CouponInput />

      <button
        className="btn-primary"
        style={{ width: '100%', padding: '12px', fontSize: 16 }}
        disabled={loading || cart.cartItems.length === 0}
        onClick={handleCheckout}
      >
        Proceed to Checkout
      </button>
    </div>
  );
}
