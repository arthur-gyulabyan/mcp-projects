import { useState } from 'react';
import { useCart } from '../../hooks/useCart';

export function CouponInput() {
  const [code, setCode] = useState('');
  const { applyCoupon, cart, loading } = useCart();

  if (cart?.couponCode) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-success)' }}>
        Coupon <strong>{cart.couponCode}</strong> applied
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input
        type="text"
        placeholder="Coupon code"
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase())}
        style={{ flex: 1 }}
      />
      <button
        className="btn-primary"
        disabled={!code || loading}
        onClick={() => { applyCoupon(code); setCode(''); }}
      >Apply</button>
    </div>
  );
}
