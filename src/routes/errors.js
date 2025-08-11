const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validation');
const Joi = require('joi');

const router = express.Router();

// Error reporting schema
const errorReportSchema = Joi.object({
    timestamp: Joi.string().isoDate().required(),
    error: Joi.object({
        name: Joi.string().required(),
        message: Joi.string().required(),
        stack: Joi.string().allow('')
    }).required(),
    context: Joi.string().required(),
    metadata: Joi.object().default({}),
    userAgent: Joi.string().allow(''),
    url: Joi.string().uri().required(),
    userId: Joi.alternatives().try(
        Joi.number().integer().positive(),
        Joi.string().valid('anonymous')
    ).required()
});

// POST /api/errors/report - Report client-side errors
router.post('/report', 
    validate(errorReportSchema),
    asyncHandler(async (req, res) => {
        const errorReport = req.body;
        
        // Log the client-side error
        console.log('📱 Client Error Report:', {
            timestamp: errorReport.timestamp,
            user: errorReport.userId,
            error: errorReport.error.name,
            message: errorReport.error.message,
            context: errorReport.context,
            url: errorReport.url,
            userAgent: errorReport.userAgent
        });
        
        // In a production environment, you might want to:
        // 1. Store errors in a database for analysis
        // 2. Send to external monitoring service (Sentry, LogRocket, etc.)
        // 3. Alert on critical errors
        // 4. Aggregate error statistics
        
        // For now, we'll just acknowledge receipt
        res.status(200).json({
            message: 'Error report received',
            reportId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });
    })
);

// GET /api/errors/health - Health check endpoint
router.get('/health', asyncHandler(async (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
    });
}));

module.exports = router;