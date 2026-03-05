export interface StockCheckResult {
  available: boolean;
  unavailableItems: string[];
}

export interface IInventoryService {
  verifyStock(items: ReadonlyArray<{ productId: string; quantity: number }>): StockCheckResult;
}
