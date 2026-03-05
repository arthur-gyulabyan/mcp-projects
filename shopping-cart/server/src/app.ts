import express from 'express';
import cors from 'cors';
import { createContainer } from './interface/container';
import { createCartRoutes } from './interface/routes/cartRoutes';
import { errorHandler } from './interface/middleware/errorHandler';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const container = createContainer();
  app.use('/api/v1', createCartRoutes(container));

  app.use(errorHandler);
  return app;
}
