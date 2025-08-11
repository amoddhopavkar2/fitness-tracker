require('dotenv').config();

/**
 * Environment variable validation and configuration
 */

const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'JWT_SECRET'
];

const optionalEnvVars = {
  DB_PATH: './fitness_tracker.db',
  ALLOWED_ORIGINS: 'http://localhost:3000,http://localhost:5000,http://localhost:3001',
  RATE_LIMIT_WINDOW_MS: '900000',
  RATE_LIMIT_MAX_REQUESTS: '100',
  BCRYPT_ROUNDS: '12',
  LOG_LEVEL: 'info'
};

/**
 * Validates that all required environment variables are present
 * @throws {Error} If any required environment variable is missing
 */
function validateEnvironment() {
  const missing = [];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file or environment configuration.'
    );
  }
  
  // Validate JWT_SECRET strength in production
  if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.length < 32) {
    throw new Error(
      'JWT_SECRET must be at least 32 characters long in production environment'
    );
  }
  
  // Validate NODE_ENV
  const validEnvironments = ['development', 'production', 'test'];
  if (!validEnvironments.includes(process.env.NODE_ENV)) {
    throw new Error(
      `NODE_ENV must be one of: ${validEnvironments.join(', ')}`
    );
  }
  
  // Validate PORT
  const port = parseInt(process.env.PORT, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid port number between 1 and 65535');
  }
  
  console.log('✅ Environment validation passed');
}

/**
 * Gets environment variable with fallback to default value
 * @param {string} key - Environment variable key
 * @param {string} defaultValue - Default value if env var is not set
 * @returns {string} Environment variable value or default
 */
function getEnvVar(key, defaultValue = '') {
  return process.env[key] || optionalEnvVars[key] || defaultValue;
}

/**
 * Gets environment variable as integer
 * @param {string} key - Environment variable key
 * @param {number} defaultValue - Default value if env var is not set
 * @returns {number} Environment variable value as integer or default
 */
function getEnvVarAsInt(key, defaultValue = 0) {
  const value = getEnvVar(key, defaultValue.toString());
  return parseInt(value, 10);
}

/**
 * Gets environment variable as boolean
 * @param {string} key - Environment variable key
 * @param {boolean} defaultValue - Default value if env var is not set
 * @returns {boolean} Environment variable value as boolean or default
 */
function getEnvVarAsBool(key, defaultValue = false) {
  const value = getEnvVar(key, defaultValue.toString()).toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}

/**
 * Gets environment variable as array (comma-separated)
 * @param {string} key - Environment variable key
 * @param {string[]} defaultValue - Default array if env var is not set
 * @returns {string[]} Environment variable value as array or default
 */
function getEnvVarAsArray(key, defaultValue = []) {
  const value = getEnvVar(key);
  if (!value) return defaultValue;
  return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
}

// Configuration object with all environment variables
const config = {
  // Application
  nodeEnv: process.env.NODE_ENV,
  port: getEnvVarAsInt('PORT', 3001),
  
  // Security
  jwtSecret: process.env.JWT_SECRET,
  bcryptRounds: getEnvVarAsInt('BCRYPT_ROUNDS', 12),
  
  // Database
  dbPath: getEnvVar('DB_PATH', './fitness_tracker.db'),
  
  // CORS
  allowedOrigins: getEnvVarAsArray('ALLOWED_ORIGINS', [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:3001'
  ]),
  
  // Rate Limiting
  rateLimitWindowMs: getEnvVarAsInt('RATE_LIMIT_WINDOW_MS', 900000),
  rateLimitMaxRequests: getEnvVarAsInt('RATE_LIMIT_MAX_REQUESTS', 100),
  
  // Logging
  logLevel: getEnvVar('LOG_LEVEL', 'info'),
  
  // Helper methods
  isDevelopment: () => config.nodeEnv === 'development',
  isProduction: () => config.nodeEnv === 'production',
  isTest: () => config.nodeEnv === 'test'
};

module.exports = {
  validateEnvironment,
  getEnvVar,
  getEnvVarAsInt,
  getEnvVarAsBool,
  getEnvVarAsArray,
  config
};