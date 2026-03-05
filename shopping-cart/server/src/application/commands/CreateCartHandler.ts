import { v4 } from 'uuid';
import { Cart } from '../../domain/entities/Cart';
import { ICartRepository } from '../../domain/repositories/ICartRepository';
import { CartDto, toCartDto } from '../dtos/mappers';

export class CreateCartHandler {
  constructor(private cartRepo: ICartRepository) {}

  execute(cmd: { customerId: string; currency: string; id?: string }): CartDto {
    const cart = Cart.create({
      id: cmd.id || `cart-${v4()}`,
      customerId: cmd.customerId,
      currency: cmd.currency,
    });
    this.cartRepo.save(cart);
    return toCartDto(cart);
  }
}
