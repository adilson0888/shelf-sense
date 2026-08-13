import type { NextFunction, Request, RequestHandler, Response } from "express";

/** Thrown by route handlers for any expected, client-facing error condition. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Express 4 doesn't forward a rejected promise from an async handler to the
 * error middleware on its own (that's Express 5 behavior) — wrap every
 * async route handler with this so a thrown HttpError (or anything else)
 * reaches errorHandler below instead of hanging the request.
 */
export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/**
 * Express error-handling middleware (registered last, in index.ts) — gives
 * every route a consistent `{ error: string }` JSON shape instead of each
 * handler rolling its own response, and keeps unexpected errors from
 * leaking implementation details to the client.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
