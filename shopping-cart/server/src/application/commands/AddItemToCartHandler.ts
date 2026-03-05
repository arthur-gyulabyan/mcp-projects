import { v4 } from 'uuid';
import { CartItem } from '../../domain/entities/CartItem';
import { ICartRepository } from '../../domain/repositories/ICartRepository';
import { IProductService } from '../../domain/services/IProductService';
import { NotFoundError, BadRequestError } from '../errors';
import { CartItemDto, toCartItemDto } from '../dtos/mappers';

export class AddItemToCartHandler {
  constructor(
    private cartRepo: ICartRepository,
    private productService: IProductService,
  ) {}

  execute(cmd: { cartId: string; productId: string; quantity: number }): CartItemDto {
    const cart = this.cartRepo.findById(cmd.cartId);
    if (!cart) throw new NotFoundError(`Cart '${cmd.cartId}' not found`);

    const product = this.productService.fetchDetails(cmd.productId);
    if (!product) throw new BadRequestError(`Product '${cmd.productId}' not found`);

    const existing = cart.items.find(i => i.productId === cmd.productId);
    if (existing) {
      cart.updateItemQuantity(existing.id, existing.quantity + cmd.quantity);
      this.cartRepo.save(cart);
      return toCartItemDto(existing);
    }

    const item = CartItem.create({
      id: `ci-${v4()}`,
      productId: product.productId,
      productName: product.productName,
      sku: product.sku,
      quantity: cmd.quantity,
      unitPrice: product.unitPrice,
      imageUrl: product.imageUrl,
    });

    cart.addItem(item);
    this.cartRepo.save(cart);
    return toCartItemDto(item);
  }
}
