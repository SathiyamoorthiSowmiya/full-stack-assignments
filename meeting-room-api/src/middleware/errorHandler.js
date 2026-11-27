const { AppError, NotFoundError } = require("../errors");

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function notFoundHandler(req, res, next) {
  next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
}

// Every error leaves the API in the same shape: { error, message }
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.errorName, message: err.message });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "ValidationError", message: "Request body is not valid JSON" });
  }
  if (err.type === "entity.too.large") {
    return res.status(400).json({ error: "ValidationError", message: "Request body is too large" });
  }
  console.error(err);
  return res.status(500).json({ error: "InternalServerError", message: "Something went wrong on our side" });
}

module.exports = { asyncHandler, notFoundHandler, errorHandler };
