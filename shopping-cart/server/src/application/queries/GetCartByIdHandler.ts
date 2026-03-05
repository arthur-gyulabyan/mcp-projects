import { ICartRepository } from '../../domain/repositories/ICartRepository';
import { GetCartByIdResponse, toGetCartByIdResponse } from '../dtos/mappers';

export class GetCartByIdHandler {
  constructor(private cartRepo: ICartRepository) {}

  execute(cartId: string): GetCartByIdResponse | null {
    const cart = this.cartRepo.findById(cartId);
    if (!cart) return null;
    return toGetCartByIdResponse(cart);
  }
}
