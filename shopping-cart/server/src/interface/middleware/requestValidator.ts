import { Request, Response, NextFunction } from 'express';

export function validateBody(...requiredFields: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missing = requiredFields.filter(f => req.body[f] === undefined || req.body[f] === null);
    if (missing.length > 0) {
      res.status(400).json({ message: `Missing required fields: ${missing.join(', ')}` });
      return;
    }
    next();
  };
}
