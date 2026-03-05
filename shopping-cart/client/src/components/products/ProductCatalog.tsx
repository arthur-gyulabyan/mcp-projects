import { useState, useEffect } from 'react';
import { Product } from '../../api/types';
import { cartApi } from '../../api/cartApi';
import { useCart } from '../../hooks/useCart';
import { ProductCard } from './ProductCard';

export function ProductCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const { cart, createCart, error } = useCart();

  useEffect(() => {
    cartApi.listProducts().then(setProducts);
  }, []);

  useEffect(() => {
    if (!cart) {
      createCart('guest-user');
    }
  }, [cart, createCart]);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Products</h1>
      {error && <div className="error-banner">{error}</div>}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 20,
      }}>
        {products.map(p => <ProductCard key={p.productId} product={p} />)}
      </div>
    </div>
  );
}
