import { IProductService, ProductDetails } from '../../domain/services/IProductService';

const CATALOG: Record<string, ProductDetails> = {
  'prod-5001': { productId: 'prod-5001', productName: 'Wireless Mouse', sku: 'WM-BLK-001', unitPrice: 29.99, imageUrl: null },
  'prod-5002': { productId: 'prod-5002', productName: 'USB-C Hub', sku: 'USB-HUB-4P', unitPrice: 49.99, imageUrl: null },
  'prod-5003': { productId: 'prod-5003', productName: 'Laptop Stand', sku: 'LS-ALU-ADJ', unitPrice: 45.00, imageUrl: null },
  'prod-5004': { productId: 'prod-5004', productName: 'Mechanical Keyboard', sku: 'KB-MEC-RGB', unitPrice: 89.99, imageUrl: null },
  'prod-5005': { productId: 'prod-5005', productName: 'Monitor Light Bar', sku: 'ML-LED-40', unitPrice: 59.99, imageUrl: null },
  'prod-5006': { productId: 'prod-5006', productName: 'Webcam HD 1080p', sku: 'WC-1080-BLK', unitPrice: 74.99, imageUrl: null },
};

export class StubProductService implements IProductService {
  fetchDetails(productId: string): ProductDetails | null {
    return CATALOG[productId] ?? null;
  }

  listAll(): ProductDetails[] {
    return Object.values(CATALOG);
  }
}
