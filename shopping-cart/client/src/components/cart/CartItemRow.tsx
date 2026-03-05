import { CartItem } from '../../api/types';
import { useCart } from '../../hooks/useCart';

export function CartItemRow({ item }: { item: CartItem }) {
  const { updateQuantity, removeItem, loading } = useCart();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '16px 0',
      borderBottom: '1px solid var(--color-border)',
    }}>
      <div style={{
        width: 64, height: 64, background: '#f3f4f6', borderRadius: 'var(--radius)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--color-text-muted)', fontSize: 24, flexShrink: 0,
      }}>
        {item.productName.charAt(0)}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{item.productName}</div>
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{item.sku}</div>
        <div style={{ fontSize: 14 }}>${item.unitPrice.toFixed(2)} each</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          className="btn-outline"
          style={{ width: 32, height: 32, padding: 0 }}
          disabled={loading || item.quantity <= 1}
          onClick={() => updateQuantity(item.id, item.quantity - 1)}
        >−</button>
        <span style={{ width: 32, textAlign: 'center', fontWeight: 600 }}>{item.quantity}</span>
        <button
          className="btn-outline"
          style={{ width: 32, height: 32, padding: 0 }}
          disabled={loading}
          onClick={() => updateQuantity(item.id, item.quantity + 1)}
        >+</button>
      </div>

      <div style={{ width: 80, textAlign: 'right', fontWeight: 600 }}>
        ${item.subtotal.toFixed(2)}
      </div>

      <button
        className="btn-danger"
        style={{ padding: '6px 12px', fontSize: 13 }}
        disabled={loading}
        onClick={() => removeItem(item.id)}
      >Remove</button>
    </div>
  );
}
