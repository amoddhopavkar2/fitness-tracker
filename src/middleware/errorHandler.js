const { config } = require('../config/env');

// Custom error classes
class AppError extends Error {
    constructor(message, statusCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.name = this.constructor.name;
        
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message, details = []) {
        super(message, 400);
        this.details = details;
    }
}

class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401);
    }
}

class AuthorizationError extends AppError {
    constructor(message = 'Access denied') {
        super(message, 403);
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404);
    }
}

class ConflictError extends AppError {
    constructor(message = 'Resource conflict') {
        super(message, 409);
    }
}

class DatabaseError extends AppError {
    constructor(message = 'Database operation failed', originalError = null) {
        super(message, 500);
        this.originalError = originalError;
    }
}

// Error logging utility
const logError = (error, req = null) => {
    const timestamp = new Date().toISOString();
    const errorInfo = {
        timestamp,
        name: error.name,
        message: error.message,
        stack: error.stack,
        statusCode: error.statusCode || 500,
        isOperational: error.isOperational || false
    };
    
    if (req) {
        errorInfo.request = {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.user?.id || 'anonymous'
        };
    }
    
    // Log to console with appropriate level
    if (error.statusCode >= 500) {
        console.error('🚨 Server Error:', errorInfo);
    } else if (error.statusCode >= 400) {
        console.warn('⚠️ Client Error:', errorInfo);
    } else {
        console.log('ℹ️ Error Info:', errorInfo);
    }
    
    // In production, you might want to send this to a logging service
    // like Winston, Sentry, or CloudWatch
    if (config.isProduction() && error.statusCode >= 500) {
        // TODO: Send to external logging service
        // Example: Sentry.captureException(error);
    }
};

// Input validation middleware
const validateInput = (schema) => {
    return (req, res, next) => {
        try {
            const { error, value } = schema.validate(req.body, { 
                abortEarly: false,
                stripUnknown: true 
            });
            
            if (error) {
                const details = error.details.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message,
                    value: detail.context?.value
                }));
                
                throw new ValidationError('Input validation failed', details);
            }
            
            req.body = value;
            next();
        } catch (err) {
            next(err);
        }
    };
};

// Async error wrapper
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// Database error handler
const handleDatabaseError = (error) => {
    // SQLite specific error handling
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return new ConflictError('Resource already exists');
    }
    
    if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        return new ValidationError('Invalid reference to related resource');
    }
    
    if (error.code === 'SQLITE_CONSTRAINT_NOTNULL') {
        return new ValidationError('Required field is missing');
    }
    
    if (error.code === 'SQLITE_CONSTRAINT_CHECK') {
        return new ValidationError('Data violates constraints');
    }
    
    // Generic database error
    return new DatabaseError('Database operation failed', error);
};

// Main error handling middleware
const errorHandler = (error, req, res, next) => {
    let err = error;
    
    // Handle different types of errors
    if (error.name === 'CastError') {
        err = new ValidationError('Invalid ID format');
    } else if (error.code && error.code.startsWith('SQLITE_')) {
        err = handleDatabaseError(error);
    } else if (error.name === 'JsonWebTokenError') {
        err = new AuthenticationError('Invalid token');
    } else if (error.name === 'TokenExpiredError') {
        err = new AuthenticationError('Token expired');
    } else if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
        err = new ValidationError('Invalid JSON format');
    } else if (!(error instanceof AppError)) {
        // Convert unknown errors to AppError
        err = new AppError(
            config.isProduction() ? 'Something went wrong' : error.message,
            500,
            false
        );
    }
    
    // Log the error
    logError(err, req);
    
    // Prepare error response
    const errorResponse = {
        error: err.name,
        message: err.message,
        statusCode: err.statusCode
    };
    
    // Add additional details for validation errors
    if (err instanceof ValidationError && err.details) {
        errorResponse.details = err.details;
    }
    
    // Add stack trace in development
    if (!config.isProduction() && err.stack) {
        errorResponse.stack = err.stack;
    }
    
    // Add request ID for tracking (if available)
    if (req.id) {
        errorResponse.requestId = req.id;
    }
    
    res.status(err.statusCode || 500).json(errorResponse);
};

// 404 handler
const notFoundHandler = (req, res, next) => {
    const error = new NotFoundError(`Route ${req.originalUrl} not found`);
    next(error);
};

// Unhandled rejection handler
const handleUnhandledRejection = () => {
    process.on('unhandledRejection', (reason, promise) => {
        console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
        // Close server gracefully
        process.exit(1);
    });
};

// Uncaught exception handler
const handleUncaughtException = () => {
    process.on('uncaughtException', (error) => {
        console.error('🚨 Uncaught Exception:', error);
        // Close server gracefully
        process.exit(1);
    });
};

module.exports = {
    // Error classes
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    DatabaseError,
    
    // Middleware functions
    errorHandler,
    notFoundHandler,
    validateInput,
    asyncHandler,
    
    // Utility functions
    logError,
    handleDatabaseError,
    handleUnhandledRejection,
    handleUncaughtException
};