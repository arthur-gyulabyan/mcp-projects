import { IInventoryService, StockCheckResult } from '../../domain/services/IInventoryService';

export class StubInventoryService implements IInventoryService {
  verifyStock(_items: ReadonlyArray<{ productId: string; quantity: number }>): StockCheckResult {
    return { available: true, unavailableItems: [] };
  }
}
