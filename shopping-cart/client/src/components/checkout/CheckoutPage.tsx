import { useCart } from '../../hooks/useCart';
import { Link } from 'react-router-dom';

export function CheckoutPage() {
  const { cart, error } = useCart();

  if (!cart) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <h2>No active cart</h2>
        <Link to="/">Browse products</Link>
      </div>
    );
  }

  const statusLabels: Record<string, { label: string; color: string }> = {
    active: { label: 'Active', color: 'var(--color-primary)' },
    checking_out: { label: 'Processing Checkout', color: '#d97706' },
    checked_out: { label: 'Order Confirmed', color: 'var(--color-success)' },
    handed_off: { label: 'Sent to Order Service', color: 'var(--color-success)' },
    expired: { label: 'Expired', color: 'var(--color-text-muted)' },
  };

  const statusInfo = statusLabels[cart.status] || { label: cart.status, color: 'var(--color-text)' };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Checkout</h1>
      {error && <div className="error-banner">{error}</div>}

      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: 32,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>
          {cart.status === 'checked_out' || cart.status === 'handed_off' ? '✓' : '⏳'}
        </div>
        <h2 style={{ marginBottom: 8, color: statusInfo.color }}>{statusInfo.label}</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 24 }}>
          Cart ID: {cart.id}
        </p>

        <div style={{ textAlign: 'left', borderTop: '1px solid var(--color-border)', paddingTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>Items</span><span>{cart.itemCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>Subtotal</span><span>${cart.subtotal.toFixed(2)}</span>
          </div>
          {cart.discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: 'var(--color-success)' }}>
              <span>Discount</span><span>-${cart.discount.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 18, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
            <span>Total</span><span>${cart.totalAmount.toFixed(2)}</span>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <Link to="/">
            <button className="btn-primary">Continue Shopping</button>
          </Link>
        </div>
      </div>
    </div>
  );
}
