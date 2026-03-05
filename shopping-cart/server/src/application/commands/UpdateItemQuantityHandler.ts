import { ICartRepository } from '../../domain/repositories/ICartRepository';
import { NotFoundError } from '../errors';
import { CartItemDto, toCartItemDto } from '../dtos/mappers';

export class UpdateItemQuantityHandler {
  constructor(private cartRepo: ICartRepository) {}

  execute(cmd: { cartId: string; cartItemId: string; quantity: number }): CartItemDto {
    const cart = this.cartRepo.findById(cmd.cartId);
    if (!cart) throw new NotFoundError(`Cart '${cmd.cartId}' not found`);

    cart.updateItemQuantity(cmd.cartItemId, cmd.quantity);
    this.cartRepo.save(cart);

    const item = cart.items.find(i => i.id === cmd.cartItemId)!;
    return toCartItemDto(item);
  }
}
