import { ICartRepository } from '../../domain/repositories/ICartRepository';
import { GetAllCartsResponse, toGetAllCartsResponse } from '../dtos/mappers';

export class GetCartsByCustomerIdHandler {
  constructor(private cartRepo: ICartRepository) {}

  execute(customerId: string, status: string): GetAllCartsResponse[] {
    const carts = this.cartRepo.findByCustomerId(customerId, status);
    return carts.map(toGetAllCartsResponse);
  }
}
