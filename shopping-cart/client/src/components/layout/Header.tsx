import { Link } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';

export function Header() {
  const { cart } = useCart();
  const itemCount = cart?.itemCount ?? 0;

  return (
    <header style={{
      background: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      padding: '16px 0',
      marginBottom: '24px',
    }}>
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ textDecoration: 'none', color: 'var(--color-text)', fontSize: '20px', fontWeight: 700 }}>
          ShopCart
        </Link>
        <nav style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <Link to="/" style={{ textDecoration: 'none', color: 'var(--color-text-muted)' }}>Products</Link>
          <Link to="/cart" style={{ textDecoration: 'none', color: 'var(--color-text-muted)', position: 'relative' }}>
            Cart
            {itemCount > 0 && (
              <span style={{
                position: 'absolute', top: -8, right: -14,
                background: 'var(--color-primary)', color: 'white',
                borderRadius: '50%', width: 20, height: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
              }}>{itemCount}</span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
