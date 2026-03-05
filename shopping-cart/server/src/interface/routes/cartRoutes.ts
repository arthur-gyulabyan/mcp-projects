import { Router, Request, Response, NextFunction } from 'express';
import { Container } from '../container';
import { validateBody } from '../middleware/requestValidator';

export function createCartRoutes(c: Container): Router {
  const router = Router();

  // Commands
  router.post('/create-cart', validateBody('customerId', 'currency'), (req: Request, res: Response, next: NextFunction) => {
    try { res.json(c.createCart.execute(req.body)); } catch (e) { next(e); }
  });

  router.post('/add-item-to-cart', validateBody('cartId', 'productId', 'quantity'), (req: Request, res: Response, next: NextFunction) => {
    try { res.json(c.addItemToCart.execute(req.body)); } catch (e) { next(e); }
  });

  router.post('/update-item-quantity', validateBody('cartId', 'cartItemId', 'quantity'), (req: Request, res: Response, next: NextFunction) => {
    try { res.json(c.updateItemQuantity.execute(req.body)); } catch (e) { next(e); }
  });

  router.post('/remove-item-from-cart', validateBody('cartId', 'cartItemId'), (req: Request, res: Response, next: NextFunction) => {
    try { res.json(c.removeItemFromCart.execute(req.body)); } catch (e) { next(e); }
  });

  router.post('/apply-coupon', validateBody('cartId', 'couponCode'), (req: Request, res: Response, next: NextFunction) => {
    try { res.json(c.applyCoupon.execute(req.body)); } catch (e) { next(e); }
  });

  router.post('/recalculate-cart-totals', validateBody('cartId'), (req: Request, res: Response, next: NextFunction) => {
    try { res.json(c.recalculateCartTotals.execute(req.body)); } catch (e) { next(e); }
  });

  router.post('/checkout-cart', validateBody('cartId'), (req: Request, res: Response, next: NextFunction) => {
    try { res.json(c.checkoutCart.execute(req.body)); } catch (e) { next(e); }
  });

  router.post('/verify-stock-availability', validateBody('cartId'), (req: Request, res: Response, next: NextFunction) => {
    try { res.json(c.verifyStockAvailability.execute(req.body)); } catch (e) { next(e); }
  });

  router.post('/complete-checkout', validateBody('cartId'), (req: Request, res: Response, next: NextFunction) => {
    try { res.json(c.completeCheckout.execute(req.body)); } catch (e) { next(e); }
  });

  router.post('/fail-checkout', validateBody('cartId', 'reason'), (req: Request, res: Response, next: NextFunction) => {
    try { res.json(c.failCheckout.execute(req.body)); } catch (e) { next(e); }
  });

  router.post('/handoff-to-order-service', validateBody('cartId', 'customerId'), (req: Request, res: Response, next: NextFunction) => {
    try { res.json(c.handoffToOrderService.execute(req.body)); } catch (e) { next(e); }
  });

  router.post('/fetch-product-details', validateBody('cartId', 'productId'), (req: Request, res: Response, next: NextFunction) => {
    try { res.json(c.fetchProductDetails.execute(req.body)); } catch (e) { next(e); }
  });

  // Queries
  router.get('/get-cart-by-id/:cartId', (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = c.getCartById.execute(req.params.cartId as string);
      if (!result) { res.status(404).json({ message: 'Cart not found' }); return; }
      res.json(result);
    } catch (e) { next(e); }
  });

  router.get('/get-all-carts/:customerId/:status', (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(c.getCartsByCustomerId.execute(req.params.customerId as string, req.params.status as string));
    } catch (e) { next(e); }
  });

  // Extra: product catalog for frontend
  router.get('/products', (_req: Request, res: Response) => {
    res.json(c.productService.listAll());
  });

  return router;
}
