import { IProductService, ProductDetails } from '../../domain/services/IProductService';
import { NotFoundError } from '../errors';

export class FetchProductDetailsHandler {
  constructor(private productService: IProductService) {}

  execute(cmd: { productId: string }): ProductDetails {
    const product = this.productService.fetchDetails(cmd.productId);
    if (!product) throw new NotFoundError(`Product '${cmd.productId}' not found`);
    return product;
  }
}
