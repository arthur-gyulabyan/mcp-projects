import { ICartRepository } from '../../domain/repositories/ICartRepository';
import { IInventoryService } from '../../domain/services/IInventoryService';
import { NotFoundError, BadRequestError } from '../errors';
import { CartDto, toCartDto } from '../dtos/mappers';

export class VerifyStockAvailabilityHandler {
  constructor(
    private cartRepo: ICartRepository,
    private inventoryService: IInventoryService,
  ) {}

  execute(cmd: { cartId: string }): CartDto {
    const cart = this.cartRepo.findById(cmd.cartId);
    if (!cart) throw new NotFoundError(`Cart '${cmd.cartId}' not found`);

    const result = this.inventoryService.verifyStock(
      cart.items.map(i => ({ productId: i.productId, quantity: i.quantity }))
    );

    if (!result.available) {
      throw new BadRequestError(`Items out of stock: ${result.unavailableItems.join(', ')}`);
    }

    return toCartDto(cart);
  }
}
