import { ICartRepository } from '../../domain/repositories/ICartRepository';
import { NotFoundError } from '../errors';
import { CartDto, toCartDto } from '../dtos/mappers';

export class FailCheckoutHandler {
  constructor(private cartRepo: ICartRepository) {}

  execute(cmd: { cartId: string; reason: string }): CartDto {
    const cart = this.cartRepo.findById(cmd.cartId);
    if (!cart) throw new NotFoundError(`Cart '${cmd.cartId}' not found`);

    cart.failCheckout();
    this.cartRepo.save(cart);
    return toCartDto(cart);
  }
}
