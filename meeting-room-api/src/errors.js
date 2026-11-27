class AppError extends Error {
  constructor(status, errorName, message) {
    super(message);
    this.status = status;
    this.errorName = errorName;
  }
}

class ValidationError extends AppError {
  constructor(message) { super(400, "ValidationError", message); }
}

class NotFoundError extends AppError {
  constructor(message) { super(404, "NotFoundError", message); }
}

class ConflictError extends AppError {
  constructor(message) { super(409, "ConflictError", message); }
}

class IdempotencyKeyReuseError extends AppError {
  constructor() {
    super(422, "IdempotencyKeyReuse", "This Idempotency-Key was already used with a different request body");
  }
}

module.exports = { AppError, ValidationError, NotFoundError, ConflictError, IdempotencyKeyReuseError };
