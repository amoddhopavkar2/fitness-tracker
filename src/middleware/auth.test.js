const jwt = require('jsonwebtoken');
const { authenticateToken, generateToken } = require('./auth');
const User = require('../models/User');
const { config } = require('../config/env');
const db = require('../database/database');

// Mock the User model
jest.mock('../models/User');

describe('Auth Middleware', () => {
  let req, res, next;
  let testUser;

  beforeEach(() => {
    req = {
      headers: {},
      user: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();

    testUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com'
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    test('should generate a valid JWT token', () => {
      const userId = 123;
      const token = generateToken(userId);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      // Verify token can be decoded
      const decoded = jwt.verify(token, config.jwtSecret);
      expect(decoded.userId).toBe(userId);
      expect(decoded.exp).toBeDefined();
    });

    test('should generate different tokens for different users', () => {
      const token1 = generateToken(1);
      const token2 = generateToken(2);
      
      expect(token1).not.toBe(token2);
    });

    test('should set expiration to 7 days', () => {
      const userId = 123;
      const token = generateToken(userId);
      const decoded = jwt.verify(token, config.jwtSecret);
      
      const now = Math.floor(Date.now() / 1000);
      const sevenDaysInSeconds = 7 * 24 * 60 * 60;
      
      expect(decoded.exp - decoded.iat).toBe(sevenDaysInSeconds);
    });
  });

  describe('authenticateToken', () => {
    test('should authenticate valid token and set user', async () => {
      const token = generateToken(testUser.id);
      req.headers.authorization = `Bearer ${token}`;
      
      User.findById.mockResolvedValue(testUser);
      
      await authenticateToken(req, res, next);
      
      expect(User.findById).toHaveBeenCalledWith(testUser.id);
      expect(req.user).toEqual(testUser);
      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should return 401 when no token provided', async () => {
      await authenticateToken(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 when authorization header is malformed', async () => {
      req.headers.authorization = 'InvalidFormat';
      
      await authenticateToken(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 when token is invalid', async () => {
      req.headers.authorization = 'Bearer invalidtoken';
      
      await authenticateToken(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 when token is expired', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: testUser.id }, 
        config.jwtSecret, 
        { expiresIn: '-1h' }
      );
      req.headers.authorization = `Bearer ${expiredToken}`;
      
      await authenticateToken(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 when user not found', async () => {
      const token = generateToken(999); // Non-existent user
      req.headers.authorization = `Bearer ${token}`;
      
      User.findById.mockResolvedValue(null);
      
      await authenticateToken(req, res, next);
      
      expect(User.findById).toHaveBeenCalledWith(999);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle database errors gracefully', async () => {
      const token = generateToken(testUser.id);
      req.headers.authorization = `Bearer ${token}`;
      
      User.findById.mockRejectedValue(new Error('Database error'));
      
      await authenticateToken(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle different authorization header formats', async () => {
      const token = generateToken(testUser.id);
      
      // Test with lowercase 'bearer'
      req.headers.authorization = `bearer ${token}`;
      User.findById.mockResolvedValue(testUser);
      
      await authenticateToken(req, res, next);
      
      expect(req.user).toEqual(testUser);
      expect(next).toHaveBeenCalledWith();
    });
  });
});