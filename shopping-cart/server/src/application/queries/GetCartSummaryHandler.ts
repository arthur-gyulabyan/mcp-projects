import { ICartRepository } from '../../domain/repositories/ICartRepository';
import { GetCartSummaryResponse, toGetCartSummaryResponse } from '../dtos/mappers';

export class GetCartSummaryHandler {
  constructor(private cartRepo: ICartRepository) {}

  execute(cartId: string): GetCartSummaryResponse | null {
    const cart = this.cartRepo.findById(cartId);
    if (!cart) return null;
    return toGetCartSummaryResponse(cart);
  }
}
