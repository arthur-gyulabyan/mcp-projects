import { ICartRepository } from '../../domain/repositories/ICartRepository';
import { NotFoundError } from '../errors';
import { CartDto, toCartDto } from '../dtos/mappers';

export class RemoveItemFromCartHandler {
  constructor(private cartRepo: ICartRepository) {}

  execute(cmd: { cartId: string; cartItemId: string }): CartDto {
    const cart = this.cartRepo.findById(cmd.cartId);
    if (!cart) throw new NotFoundError(`Cart '${cmd.cartId}' not found`);

    cart.removeItem(cmd.cartItemId);
    this.cartRepo.save(cart);
    return toCartDto(cart);
  }
}
