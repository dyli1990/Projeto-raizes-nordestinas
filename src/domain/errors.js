// Erros de domínio/aplicação. Cada erro carrega o status HTTP e um código
// estável (ex.: ESTOQUE_INSUFICIENTE) que o middleware de erro converte no
// formato JSON padronizado da API.

class AppError extends Error {
  constructor(status, error, message, details = []) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.error = error;
    this.details = details;
  }
}

class BadRequestError extends AppError {
  constructor(error, message, details) {
    super(400, error, message, details);
  }
}

class UnauthorizedError extends AppError {
  constructor(error, message, details) {
    super(401, error, message, details);
  }
}

class ForbiddenError extends AppError {
  constructor(error, message, details) {
    super(403, error, message, details);
  }
}

class NotFoundError extends AppError {
  constructor(error, message, details) {
    super(404, error, message, details);
  }
}

// Conflito com o estado atual do recurso (estoque, status, duplicidade).
class ConflictError extends AppError {
  constructor(error, message, details) {
    super(409, error, message, details);
  }
}

// Entrada sintaticamente válida, mas que viola uma regra de negócio.
class BusinessRuleError extends AppError {
  constructor(error, message, details) {
    super(422, error, message, details);
  }
}

class ServiceUnavailableError extends AppError {
  constructor(error, message, details) {
    super(503, error, message, details);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  ServiceUnavailableError,
};
