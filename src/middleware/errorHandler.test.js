const {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  errorHandler,
  notFoundHandler,
  validateInput,
  asyncHandler,
  logError,
  handleDatabaseError
} = require('./errorHandler');
const Joi = require('joi');

// Mock console methods
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

describe('Error Handler Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'GET',
      originalUrl: '/test',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-user-agent'),
      user: { id: 1 }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();

    jest.clearAllMocks();
  });

  describe('Error Classes', () => {
    test('AppError should create error with correct properties', () => {
      const error = new AppError('Test error', 400);
      
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('AppError');
    });

    test('ValidationError should extend AppError with details', () => {
      const details = [{ field: 'username', message: 'Required' }];
      const error = new ValidationError('Validation failed', details);
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual(details);
    });

    test('AuthenticationError should have 401 status', () => {
      const error = new AuthenticationError();
      
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Authentication failed');
    });

    test('AuthorizationError should have 403 status', () => {
      const error = new AuthorizationError();
      
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Access denied');
    });

    test('NotFoundError should have 404 status', () => {
      const error = new NotFoundError();
      
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Resource not found');
    });

    test('ConflictError should have 409 status', () => {
      const error = new ConflictError();
      
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Resource conflict');
    });

    test('DatabaseError should have 500 status and store original error', () => {
      const originalError = new Error('DB connection failed');
      const error = new DatabaseError('Database error', originalError);
      
      expect(error.statusCode).toBe(500);
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('logError', () => {
    test('should log server errors with error level', () => {
      const error = new AppError('Server error', 500);
      
      logError(error, req);
      
      expect(console.error).toHaveBeenCalledWith(
        '🚨 Server Error:',
        expect.objectContaining({
          name: 'AppError',
          message: 'Server error',
          statusCode: 500,
          request: expect.objectContaining({
            method: 'GET',
            url: '/test',
            userId: 1
          })
        })
      );
    });

    test('should log client errors with warn level', () => {
      const error = new ValidationError('Invalid input');
      
      logError(error, req);
      
      expect(console.warn).toHaveBeenCalledWith(
        '⚠️ Client Error:',
        expect.objectContaining({
          name: 'ValidationError',
          statusCode: 400
        })
      );
    });

    test('should log without request info when req is null', () => {
      const error = new AppError('Test error', 400);
      
      logError(error, null);
      
      expect(console.warn).toHaveBeenCalledWith(
        '⚠️ Client Error:',
        expect.not.objectContaining({
          request: expect.anything()
        })
      );
    });
  });

  describe('handleDatabaseError', () => {
    test('should handle SQLITE_CONSTRAINT_UNIQUE', () => {
      const dbError = { code: 'SQLITE_CONSTRAINT_UNIQUE' };
      const error = handleDatabaseError(dbError);
      
      expect(error).toBeInstanceOf(ConflictError);
      expect(error.message).toBe('Resource already exists');
    });

    test('should handle SQLITE_CONSTRAINT_FOREIGNKEY', () => {
      const dbError = { code: 'SQLITE_CONSTRAINT_FOREIGNKEY' };
      const error = handleDatabaseError(dbError);
      
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Invalid reference to related resource');
    });

    test('should handle SQLITE_CONSTRAINT_NOTNULL', () => {
      const dbError = { code: 'SQLITE_CONSTRAINT_NOTNULL' };
      const error = handleDatabaseError(dbError);
      
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Required field is missing');
    });

    test('should handle generic database errors', () => {
      const dbError = { code: 'SQLITE_UNKNOWN_ERROR' };
      const error = handleDatabaseError(dbError);
      
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.originalError).toBe(dbError);
    });
  });

  describe('errorHandler', () => {
    test('should handle AppError correctly', () => {
      const error = new ValidationError('Validation failed', [
        { field: 'username', message: 'Required' }
      ]);
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'ValidationError',
        message: 'Validation failed',
        statusCode: 400,
        details: [{ field: 'username', message: 'Required' }]
      });
    });

    test('should handle JWT errors', () => {
      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'AuthenticationError',
        message: 'Invalid token',
        statusCode: 401
      });
    });

    test('should handle expired token errors', () => {
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'AuthenticationError',
        message: 'Token expired',
        statusCode: 401
      });
    });

    test('should handle SQLite database errors', () => {
      const error = { code: 'SQLITE_CONSTRAINT_UNIQUE', message: 'UNIQUE constraint failed' };
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: 'ConflictError',
        message: 'Resource already exists',
        statusCode: 409
      });
    });

    test('should handle JSON syntax errors', () => {
      const error = new SyntaxError('Unexpected token in JSON');
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'ValidationError',
        message: 'Invalid JSON format',
        statusCode: 400
      });
    });

    test('should convert unknown errors to AppError', () => {
      const error = new Error('Unknown error');
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'AppError',
        message: 'Unknown error',
        statusCode: 500
      });
    });

    test('should include request ID when available', () => {
      req.id = 'test-request-id';
      const error = new AppError('Test error', 400);
      
      errorHandler(error, req, res, next);
      
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'test-request-id'
        })
      );
    });
  });

  describe('notFoundHandler', () => {
    test('should create NotFoundError for unmatched routes', () => {
      req.originalUrl = '/api/nonexistent';
      
      notFoundHandler(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      expect(next.mock.calls[0][0].message).toContain('/api/nonexistent');
    });
  });

  describe('validateInput', () => {
    test('should pass validation with valid data', () => {
      const schema = Joi.object({
        name: Joi.string().required(),
        age: Joi.number().required()
      });
      
      const middleware = validateInput(schema);
      req.body = { name: 'John', age: 30 };
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({ name: 'John', age: 30 });
    });

    test('should throw ValidationError for invalid data', () => {
      const schema = Joi.object({
        name: Joi.string().required(),
        age: Joi.number().required()
      });
      
      const middleware = validateInput(schema);
      req.body = { name: 'John' }; // missing age
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('should strip unknown fields', () => {
      const schema = Joi.object({
        name: Joi.string().required()
      });
      
      const middleware = validateInput(schema);
      req.body = { name: 'John', unknownField: 'value' };
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith();
      expect(req.body.unknownField).toBeUndefined();
    });
  });

  describe('asyncHandler', () => {
    test('should handle successful async operations', async () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const wrappedFn = asyncHandler(asyncFn);
      
      await wrappedFn(req, res, next);
      
      expect(asyncFn).toHaveBeenCalledWith(req, res, next);
      expect(next).not.toHaveBeenCalled();
    });

    test('should catch and pass async errors to next', async () => {
      const error = new Error('Async error');
      const asyncFn = jest.fn().mockRejectedValue(error);
      const wrappedFn = asyncHandler(asyncFn);
      
      await wrappedFn(req, res, next);
      
      expect(next).toHaveBeenCalledWith(error);
    });

    test('should handle non-promise functions', async () => {
      const syncFn = jest.fn().mockReturnValue('success');
      const wrappedFn = asyncHandler(syncFn);
      
      await wrappedFn(req, res, next);
      
      expect(syncFn).toHaveBeenCalledWith(req, res, next);
      expect(next).not.toHaveBeenCalled();
    });
  });
});