const User = require('./User');
const db = require('../database/database');

describe('User Model', () => {
  beforeEach(async () => {
    await db.runAsync('DELETE FROM exercises');
    await db.runAsync('DELETE FROM workouts');
    await db.runAsync('DELETE FROM users');
  });

  afterAll(async () => {
    await db.close();
  });

  describe('create', () => {
    test('should create a new user with valid data', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const user = await User.create(userData);
      
      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.username).toBe(userData.username);
      expect(user.email).toBe(userData.email);
      expect(user.password).not.toBe(userData.password); // Should be hashed
      expect(user.created_at).toBeDefined();
    });

    test('should throw error for duplicate username', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      await User.create(userData);
      
      await expect(User.create(userData)).rejects.toThrow();
    });

    test('should throw error for duplicate email', async () => {
      const userData1 = {
        username: 'testuser1',
        email: 'test@example.com',
        password: 'password123'
      };

      const userData2 = {
        username: 'testuser2',
        email: 'test@example.com',
        password: 'password123'
      };

      await User.create(userData1);
      
      await expect(User.create(userData2)).rejects.toThrow();
    });
  });

  describe('findByUsername', () => {
    test('should find user by username', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      await User.create(userData);
      const user = await User.findByUsername('testuser');
      
      expect(user).toBeDefined();
      expect(user.username).toBe('testuser');
    });

    test('should return null for non-existent username', async () => {
      const user = await User.findByUsername('nonexistent');
      expect(user).toBeNull();
    });
  });

  describe('findById', () => {
    test('should find user by id', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const createdUser = await User.create(userData);
      const user = await User.findById(createdUser.id);
      
      expect(user).toBeDefined();
      expect(user.id).toBe(createdUser.id);
    });

    test('should return null for non-existent id', async () => {
      const user = await User.findById(999);
      expect(user).toBeNull();
    });
  });

  describe('validatePassword', () => {
    test('should validate correct password', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const user = await User.create(userData);
      const isValid = await User.validatePassword('password123', user.password);
      
      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const user = await User.create(userData);
      const isValid = await User.validatePassword('wrongpassword', user.password);
      
      expect(isValid).toBe(false);
    });
  });
}); 