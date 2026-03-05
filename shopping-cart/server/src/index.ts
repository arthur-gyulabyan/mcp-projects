import { createApp } from './app';
import { config } from './config';

const app = createApp();
app.listen(config.port, () => {
  console.log(`Shopping Cart API running on http://localhost:${config.port}`);
});
