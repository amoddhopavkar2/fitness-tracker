const { validateEnvironment, config, getEnvVar, getEnvVarAsInt, getEnvVarAsArray } = require('./env');

describe('Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables before each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('validateEnvironment', () => {
    test('should pass validation with all required variables', () => {
      process.env.NODE_ENV = 'test';
      process.env.PORT = '3001';
      process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough';

      expect(() => validateEnvironment()).not.toThrow();
    });

    test('should throw error when required variables are missing', () => {
      delete process.env.NODE_ENV;
      delete process.env.PORT;
      delete process.env.JWT_SECRET;

      expect(() => validateEnvironment()).toThrow('Missing required environment variables');
    });

    test('should throw error for invalid NODE_ENV', () => {
      process.env.NODE_ENV = 'invalid';
      process.env.PORT = '3001';
      process.env.JWT_SECRET = 'test-secret-key';

      expect(() => validateEnvironment()).toThrow('NODE_ENV must be one of');
    });

    test('should throw error for invalid PORT', () => {
      process.env.NODE_ENV = 'test';
      process.env.PORT = 'invalid';
      process.env.JWT_SECRET = 'test-secret-key';

      expect(() => validateEnvironment()).toThrow('PORT must be a valid port number');
    });

    test('should throw error for short JWT_SECRET in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '3001';
      process.env.JWT_SECRET = 'short';

      expect(() => validateEnvironment()).toThrow('JWT_SECRET must be at least 32 characters long');
    });
  });

  describe('getEnvVar', () => {
    test('should return environment variable value', () => {
      process.env.TEST_VAR = 'test-value';
      expect(getEnvVar('TEST_VAR')).toBe('test-value');
    });

    test('should return default value when env var is not set', () => {
      expect(getEnvVar('NON_EXISTENT_VAR', 'default')).toBe('default');
    });
  });

  describe('getEnvVarAsInt', () => {
    test('should return integer value', () => {
      process.env.TEST_INT = '42';
      expect(getEnvVarAsInt('TEST_INT')).toBe(42);
    });

    test('should return default value for non-existent var', () => {
      expect(getEnvVarAsInt('NON_EXISTENT_INT', 100)).toBe(100);
    });
  });

  describe('getEnvVarAsArray', () => {
    test('should return array from comma-separated string', () => {
      process.env.TEST_ARRAY = 'item1,item2,item3';
      expect(getEnvVarAsArray('TEST_ARRAY')).toEqual(['item1', 'item2', 'item3']);
    });

    test('should handle spaces in comma-separated string', () => {
      process.env.TEST_ARRAY = 'item1, item2 , item3';
      expect(getEnvVarAsArray('TEST_ARRAY')).toEqual(['item1', 'item2', 'item3']);
    });

    test('should return default array for non-existent var', () => {
      expect(getEnvVarAsArray('NON_EXISTENT_ARRAY', ['default'])).toEqual(['default']);
    });
  });

  describe('config object', () => {
    test('should have all required properties', () => {
      process.env.NODE_ENV = 'test';
      process.env.PORT = '3001';
      process.env.JWT_SECRET = 'test-secret-key';

      expect(config).toHaveProperty('nodeEnv');
      expect(config).toHaveProperty('port');
      expect(config).toHaveProperty('jwtSecret');
      expect(config).toHaveProperty('bcryptRounds');
      expect(config).toHaveProperty('dbPath');
      expect(config).toHaveProperty('allowedOrigins');
      expect(config).toHaveProperty('rateLimitWindowMs');
      expect(config).toHaveProperty('rateLimitMaxRequests');
      expect(config).toHaveProperty('logLevel');
    });

    test('should have helper methods', () => {
      expect(typeof config.isDevelopment).toBe('function');
      expect(typeof config.isProduction).toBe('function');
      expect(typeof config.isTest).toBe('function');
    });
  });
});