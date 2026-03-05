export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) { super(404, message); }
}

export class BadRequestError extends AppError {
  constructor(message: string) { super(400, message); }
}
