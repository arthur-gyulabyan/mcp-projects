import path from 'path';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'shopping-cart.db'),
  cartTtlDays: 7,
};
