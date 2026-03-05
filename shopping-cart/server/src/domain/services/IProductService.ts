export interface ProductDetails {
  productId: string;
  productName: string;
  sku: string;
  unitPrice: number;
  imageUrl: string | null;
}

export interface IProductService {
  fetchDetails(productId: string): ProductDetails | null;
  listAll(): ProductDetails[];
}
