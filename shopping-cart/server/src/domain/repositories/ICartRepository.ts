import { Cart } from '../entities/Cart';

export interface ICartRepository {
  findById(id: string): Cart | null;
  findByCustomerId(customerId: string, status?: string): Cart[];
  save(cart: Cart): void;
  delete(id: string): void;
}
