const express = require('express');
const User = require('../models/User');
const { authenticateToken, generateToken } = require('../middleware/auth');
const { 
    asyncHandler, 
    AuthenticationError, 
    ConflictError,
    ValidationError 
} = require('../middleware/errorHandler');
const { validate, userSchemas } = require('../middleware/validation');

const router = express.Router();

// Register new user
router.post('/register', 
    validate(userSchemas.register),
    asyncHandler(async (req, res) => {
        const { username, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findByUsername(username);
        if (existingUser) {
            throw new ConflictError('Username already exists');
        }

        // Create new user
        const user = await User.create({
            username,
            email,
            password
        });

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;

        res.status(201).json({
            message: 'User registered successfully',
            user: userWithoutPassword
        });
    })
);

// Login user
router.post('/login', 
    validate(userSchemas.login),
    asyncHandler(async (req, res) => {
        const { username, password } = req.body;

        // Find user by username
        const user = await User.findByUsername(username);
        if (!user) {
            throw new AuthenticationError('Invalid credentials');
        }

        // Validate password
        const isValidPassword = await User.validatePassword(password, user.password);
        if (!isValidPassword) {
            throw new AuthenticationError('Invalid credentials');
        }

        // Generate JWT token
        const token = generateToken(user.id);

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;

        res.json({
            message: 'Login successful',
            token,
            user: userWithoutPassword
        });
    })
);

// Get current user profile
router.get('/me', 
    authenticateToken, 
    asyncHandler(async (req, res) => {
        const { password: _, ...userWithoutPassword } = req.user;
        
        res.json({
            user: userWithoutPassword
        });
    })
);

module.exports = router; 