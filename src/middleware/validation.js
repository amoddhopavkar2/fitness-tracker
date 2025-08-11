const Joi = require('joi');

// Common validation patterns
const patterns = {
    username: /^[a-zA-Z0-9_]{3,30}$/,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    password: /^.{6,100}$/
};

// User validation schemas
const userSchemas = {
    register: Joi.object({
        username: Joi.string()
            .pattern(patterns.username)
            .min(3)
            .max(30)
            .required()
            .messages({
                'string.pattern.base': 'Username can only contain letters, numbers, and underscores',
                'string.min': 'Username must be at least 3 characters long',
                'string.max': 'Username cannot exceed 30 characters',
                'any.required': 'Username is required'
            }),
        
        email: Joi.string()
            .email()
            .max(255)
            .required()
            .messages({
                'string.email': 'Please provide a valid email address',
                'string.max': 'Email cannot exceed 255 characters',
                'any.required': 'Email is required'
            }),
        
        password: Joi.string()
            .min(6)
            .max(100)
            .required()
            .messages({
                'string.min': 'Password must be at least 6 characters long',
                'string.max': 'Password cannot exceed 100 characters',
                'any.required': 'Password is required'
            })
    }),
    
    login: Joi.object({
        username: Joi.string()
            .min(3)
            .max(30)
            .required()
            .messages({
                'string.min': 'Username must be at least 3 characters long',
                'string.max': 'Username cannot exceed 30 characters',
                'any.required': 'Username is required'
            }),
        
        password: Joi.string()
            .min(6)
            .max(100)
            .required()
            .messages({
                'string.min': 'Password must be at least 6 characters long',
                'string.max': 'Password cannot exceed 100 characters',
                'any.required': 'Password is required'
            })
    })
};

// Workout validation schemas
const workoutSchemas = {
    create: Joi.object({
        name: Joi.string()
            .min(1)
            .max(255)
            .required()
            .messages({
                'string.min': 'Workout name cannot be empty',
                'string.max': 'Workout name cannot exceed 255 characters',
                'any.required': 'Workout name is required'
            }),
        
        description: Joi.string()
            .max(1000)
            .allow('')
            .messages({
                'string.max': 'Description cannot exceed 1000 characters'
            }),
        
        day: Joi.string()
            .pattern(/^\d{4}-\d{2}-\d{2}$/)
            .required()
            .messages({
                'string.pattern.base': 'Day must be in YYYY-MM-DD format',
                'any.required': 'Day is required'
            }),
        
        exercises: Joi.array()
            .items(Joi.object({
                name: Joi.string()
                    .min(1)
                    .max(255)
                    .required()
                    .messages({
                        'string.min': 'Exercise name cannot be empty',
                        'string.max': 'Exercise name cannot exceed 255 characters',
                        'any.required': 'Exercise name is required'
                    }),
                
                category: Joi.string()
                    .valid('strength', 'cardio', 'flexibility', 'balance', 'sports')
                    .required()
                    .messages({
                        'any.only': 'Category must be one of: strength, cardio, flexibility, balance, sports',
                        'any.required': 'Exercise category is required'
                    }),
                
                sets: Joi.number()
                    .integer()
                    .min(1)
                    .max(50)
                    .allow(null)
                    .messages({
                        'number.base': 'Sets must be a number',
                        'number.integer': 'Sets must be a whole number',
                        'number.min': 'Sets must be at least 1',
                        'number.max': 'Sets cannot exceed 50'
                    }),
                
                reps: Joi.number()
                    .integer()
                    .min(1)
                    .max(1000)
                    .allow(null)
                    .messages({
                        'number.base': 'Reps must be a number',
                        'number.integer': 'Reps must be a whole number',
                        'number.min': 'Reps must be at least 1',
                        'number.max': 'Reps cannot exceed 1000'
                    }),
                
                duration: Joi.number()
                    .integer()
                    .min(1)
                    .max(7200) // 2 hours max
                    .allow(null)
                    .messages({
                        'number.base': 'Duration must be a number',
                        'number.integer': 'Duration must be a whole number',
                        'number.min': 'Duration must be at least 1 second',
                        'number.max': 'Duration cannot exceed 2 hours (7200 seconds)'
                    }),
                
                weight: Joi.number()
                    .min(0)
                    .max(1000)
                    .allow(null)
                    .messages({
                        'number.base': 'Weight must be a number',
                        'number.min': 'Weight cannot be negative',
                        'number.max': 'Weight cannot exceed 1000'
                    })
            }))
            .min(1)
            .max(50)
            .required()
            .messages({
                'array.min': 'At least one exercise is required',
                'array.max': 'Cannot have more than 50 exercises per workout',
                'any.required': 'Exercises are required'
            })
    }),
    
    update: Joi.object({
        name: Joi.string()
            .min(1)
            .max(255)
            .messages({
                'string.min': 'Workout name cannot be empty',
                'string.max': 'Workout name cannot exceed 255 characters'
            }),
        
        description: Joi.string()
            .max(1000)
            .allow('')
            .messages({
                'string.max': 'Description cannot exceed 1000 characters'
            }),
        
        completed: Joi.boolean()
            .messages({
                'boolean.base': 'Completed must be true or false'
            })
    })
};

// Exercise validation schemas
const exerciseSchemas = {
    update: Joi.object({
        completed: Joi.boolean()
            .required()
            .messages({
                'boolean.base': 'Completed must be true or false',
                'any.required': 'Completed status is required'
            }),
        
        notes: Joi.string()
            .max(500)
            .allow('')
            .messages({
                'string.max': 'Notes cannot exceed 500 characters'
            })
    })
};

// Parameter validation schemas
const paramSchemas = {
    id: Joi.object({
        id: Joi.number()
            .integer()
            .positive()
            .required()
            .messages({
                'number.base': 'ID must be a number',
                'number.integer': 'ID must be a whole number',
                'number.positive': 'ID must be positive',
                'any.required': 'ID is required'
            })
    }),
    
    day: Joi.object({
        day: Joi.string()
            .pattern(/^\d{4}-\d{2}-\d{2}$/)
            .required()
            .messages({
                'string.pattern.base': 'Day must be in YYYY-MM-DD format',
                'any.required': 'Day is required'
            })
    }),
    
    month: Joi.object({
        month: Joi.string()
            .pattern(/^\d{4}-\d{2}$/)
            .required()
            .messages({
                'string.pattern.base': 'Month must be in YYYY-MM format',
                'any.required': 'Month is required'
            })
    })
};

// Query parameter validation schemas
const querySchemas = {
    pagination: Joi.object({
        page: Joi.number()
            .integer()
            .min(1)
            .default(1)
            .messages({
                'number.base': 'Page must be a number',
                'number.integer': 'Page must be a whole number',
                'number.min': 'Page must be at least 1'
            }),
        
        limit: Joi.number()
            .integer()
            .min(1)
            .max(100)
            .default(10)
            .messages({
                'number.base': 'Limit must be a number',
                'number.integer': 'Limit must be a whole number',
                'number.min': 'Limit must be at least 1',
                'number.max': 'Limit cannot exceed 100'
            })
    }),
    
    dateRange: Joi.object({
        startDate: Joi.string()
            .pattern(/^\d{4}-\d{2}-\d{2}$/)
            .messages({
                'string.pattern.base': 'Start date must be in YYYY-MM-DD format'
            }),
        
        endDate: Joi.string()
            .pattern(/^\d{4}-\d{2}-\d{2}$/)
            .messages({
                'string.pattern.base': 'End date must be in YYYY-MM-DD format'
            })
    })
};

// Validation middleware factory
const validate = (schema, source = 'body') => {
    return (req, res, next) => {
        const data = req[source];
        const { error, value } = schema.validate(data, { 
            abortEarly: false,
            stripUnknown: true,
            convert: true
        });
        
        if (error) {
            const details = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));
            
            const validationError = new Error('Validation failed');
            validationError.name = 'ValidationError';
            validationError.details = details;
            validationError.statusCode = 400;
            
            return next(validationError);
        }
        
        req[source] = value;
        next();
    };
};

module.exports = {
    userSchemas,
    workoutSchemas,
    exerciseSchemas,
    paramSchemas,
    querySchemas,
    validate
};