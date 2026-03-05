import { Product } from '../../api/types';
import { useCart } from '../../hooks/useCart';

export function ProductCard({ product }: { product: Product }) {
  const { cart, addItem, loading } = useCart();

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius)',
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{
        height: 120, background: '#f3f4f6', borderRadius: 'var(--radius)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--color-text-muted)', fontSize: 32,
      }}>
        {product.productName.charAt(0)}
      </div>
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>{product.productName}</h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>SKU: {product.sku}</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
        <span style={{ fontSize: 18, fontWeight: 700 }}>${product.unitPrice.toFixed(2)}</span>
        <button
          className="btn-primary"
          disabled={!cart || loading}
          onClick={() => addItem(product.productId)}
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
}
