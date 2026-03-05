import { getDatabase } from '../infrastructure/database/database';
import { runMigrations } from '../infrastructure/database/migrations';
import { SqliteCartRepository } from '../infrastructure/repositories/SqliteCartRepository';
import { SqliteCouponRepository } from '../infrastructure/repositories/SqliteCouponRepository';
import { StubProductService } from '../infrastructure/services/StubProductService';
import { StubInventoryService } from '../infrastructure/services/StubInventoryService';
import { CreateCartHandler } from '../application/commands/CreateCartHandler';
import { AddItemToCartHandler } from '../application/commands/AddItemToCartHandler';
import { UpdateItemQuantityHandler } from '../application/commands/UpdateItemQuantityHandler';
import { RemoveItemFromCartHandler } from '../application/commands/RemoveItemFromCartHandler';
import { ApplyCouponHandler } from '../application/commands/ApplyCouponHandler';
import { RecalculateCartTotalsHandler } from '../application/commands/RecalculateCartTotalsHandler';
import { CheckoutCartHandler } from '../application/commands/CheckoutCartHandler';
import { VerifyStockAvailabilityHandler } from '../application/commands/VerifyStockAvailabilityHandler';
import { CompleteCheckoutHandler } from '../application/commands/CompleteCheckoutHandler';
import { FailCheckoutHandler } from '../application/commands/FailCheckoutHandler';
import { HandoffToOrderServiceHandler } from '../application/commands/HandoffToOrderServiceHandler';
import { FetchProductDetailsHandler } from '../application/commands/FetchProductDetailsHandler';
import { GetCartByIdHandler } from '../application/queries/GetCartByIdHandler';
import { GetCartsByCustomerIdHandler } from '../application/queries/GetCartsByCustomerIdHandler';
import { GetCartSummaryHandler } from '../application/queries/GetCartSummaryHandler';

export function createContainer() {
  const db = getDatabase();
  runMigrations(db);

  // Seed coupons on startup
  const seedStmt = db.prepare(
    'INSERT OR IGNORE INTO coupons (code, discount_type, discount_value, min_order_amount) VALUES (?, ?, ?, ?)'
  );
  const seedTransaction = db.transaction(() => {
    seedStmt.run('SAVE10', 'percentage', 10, 50);
    seedStmt.run('WELCOME20', 'fixed', 20, 0);
    seedStmt.run('SUMMER15', 'percentage', 15, 75);
  });
  seedTransaction();

  const cartRepo = new SqliteCartRepository(db);
  const couponRepo = new SqliteCouponRepository(db);
  const productService = new StubProductService();
  const inventoryService = new StubInventoryService();

  return {
    createCart: new CreateCartHandler(cartRepo),
    addItemToCart: new AddItemToCartHandler(cartRepo, productService),
    updateItemQuantity: new UpdateItemQuantityHandler(cartRepo),
    removeItemFromCart: new RemoveItemFromCartHandler(cartRepo),
    applyCoupon: new ApplyCouponHandler(cartRepo, couponRepo),
    recalculateCartTotals: new RecalculateCartTotalsHandler(cartRepo),
    checkoutCart: new CheckoutCartHandler(cartRepo),
    verifyStockAvailability: new VerifyStockAvailabilityHandler(cartRepo, inventoryService),
    completeCheckout: new CompleteCheckoutHandler(cartRepo),
    failCheckout: new FailCheckoutHandler(cartRepo),
    handoffToOrderService: new HandoffToOrderServiceHandler(cartRepo),
    fetchProductDetails: new FetchProductDetailsHandler(productService),
    getCartById: new GetCartByIdHandler(cartRepo),
    getCartsByCustomerId: new GetCartsByCustomerIdHandler(cartRepo),
    getCartSummary: new GetCartSummaryHandler(cartRepo),
    productService,
  };
}

export type Container = ReturnType<typeof createContainer>;
