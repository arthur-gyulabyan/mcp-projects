import { ICartRepository } from '../../domain/repositories/ICartRepository';
import { ICouponRepository } from '../../domain/repositories/ICouponRepository';
import { NotFoundError, BadRequestError } from '../errors';
import { CartDto, toCartDto } from '../dtos/mappers';

export class ApplyCouponHandler {
  constructor(
    private cartRepo: ICartRepository,
    private couponRepo: ICouponRepository,
  ) {}

  execute(cmd: { cartId: string; couponCode: string }): CartDto {
    const cart = this.cartRepo.findById(cmd.cartId);
    if (!cart) throw new NotFoundError(`Cart '${cmd.cartId}' not found`);

    const coupon = this.couponRepo.findByCode(cmd.couponCode);
    if (!coupon) throw new BadRequestError(`Invalid coupon code '${cmd.couponCode}'`);

    cart.applyCoupon(coupon);
    this.cartRepo.save(cart);
    return toCartDto(cart);
  }
}
