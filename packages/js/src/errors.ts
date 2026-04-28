/**
 * Base error type for all SDK failures. Instances always carry the HTTP
 * status (or 0 for transport errors) and the upstream `requestId` when the
 * server returned one.
 */
export class HaruspexError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly body?: unknown;

  constructor(
    message: string,
    opts: { status: number; code?: string; requestId?: string; body?: unknown } = {
      status: 0,
    },
  ) {
    super(message);
    this.name = "HaruspexError";
    this.status = opts.status;
    this.code = opts.code;
    this.requestId = opts.requestId;
    this.body = opts.body;
  }
}

export class HaruspexAuthError extends HaruspexError {
  constructor(message: string, opts: ConstructorParameters<typeof HaruspexError>[1]) {
    super(message, opts);
    this.name = "HaruspexAuthError";
  }
}

export class HaruspexNotFoundError extends HaruspexError {
  constructor(message: string, opts: ConstructorParameters<typeof HaruspexError>[1]) {
    super(message, opts);
    this.name = "HaruspexNotFoundError";
  }
}

export class HaruspexRateLimitError extends HaruspexError {
  readonly retryAfterMs?: number;

  constructor(
    message: string,
    opts: ConstructorParameters<typeof HaruspexError>[1] & { retryAfterMs?: number },
  ) {
    super(message, opts);
    this.name = "HaruspexRateLimitError";
    this.retryAfterMs = opts.retryAfterMs;
  }
}

export class HaruspexValidationError extends HaruspexError {
  constructor(message: string, opts: ConstructorParameters<typeof HaruspexError>[1] = { status: 400 }) {
    super(message, opts);
    this.name = "HaruspexValidationError";
  }
}

export class HaruspexServerError extends HaruspexError {
  constructor(message: string, opts: ConstructorParameters<typeof HaruspexError>[1]) {
    super(message, opts);
    this.name = "HaruspexServerError";
  }
}

export class HaruspexNetworkError extends HaruspexError {
  constructor(message: string, opts: ConstructorParameters<typeof HaruspexError>[1] = { status: 0 }) {
    super(message, opts);
    this.name = "HaruspexNetworkError";
  }
}
