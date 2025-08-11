# Environment Configuration

This document explains how to configure the Fitness Tracker application using environment variables.

## Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file with your specific configuration values.

## Environment Variables

### Required Variables

- **NODE_ENV**: Application environment (`development`, `production`, or `test`)
- **PORT**: Port number for the server (e.g., `3001`)
- **JWT_SECRET**: Secret key for JWT token signing (must be at least 32 characters in production)

### Optional Variables

- **DB_PATH**: Path to SQLite database file (default: `./fitness_tracker.db`)
- **ALLOWED_ORIGINS**: Comma-separated list of allowed CORS origins
- **RATE_LIMIT_WINDOW_MS**: Rate limiting window in milliseconds (default: `900000` = 15 minutes)
- **RATE_LIMIT_MAX_REQUESTS**: Maximum requests per window (default: `100`)
- **BCRYPT_ROUNDS**: Number of bcrypt salt rounds (default: `12`)
- **LOG_LEVEL**: Logging level (`error`, `warn`, `info`, `debug`)

## Example Configuration

### Development
```env
NODE_ENV=development
PORT=3001
JWT_SECRET=your-development-secret-key-make-it-long-and-secure
DB_PATH=./fitness_tracker.db
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5000,http://localhost:3001
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
BCRYPT_ROUNDS=12
LOG_LEVEL=info
```

### Production
```env
NODE_ENV=production
PORT=80
JWT_SECRET=your-super-secure-production-jwt-secret-key-at-least-32-characters-long
DB_PATH=/var/lib/fitness-tracker/fitness_tracker.db
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=50
BCRYPT_ROUNDS=14
LOG_LEVEL=warn
```

## Validation

The application validates environment variables on startup and will exit with an error if:

- Required variables are missing
- NODE_ENV is not one of the valid values
- PORT is not a valid port number
- JWT_SECRET is too short in production (< 32 characters)

## Security Notes

1. **Never commit `.env` files to version control** - they contain sensitive information
2. **Use strong JWT secrets** - especially in production environments
3. **Limit CORS origins** - only include domains that need access to your API
4. **Adjust rate limiting** - based on your expected traffic patterns
5. **Use appropriate bcrypt rounds** - higher values are more secure but slower

## Troubleshooting

### Common Issues

1. **"Missing required environment variables"**
   - Ensure all required variables are set in your `.env` file
   - Check for typos in variable names

2. **"JWT_SECRET must be at least 32 characters long"**
   - Generate a longer, more secure JWT secret for production

3. **"PORT must be a valid port number"**
   - Ensure PORT is a number between 1 and 65535

4. **Database connection issues**
   - Check that the DB_PATH directory exists and is writable
   - Ensure the application has proper file permissions

### Generating Secure Secrets

For JWT_SECRET, you can generate a secure random string using:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Using OpenSSL
openssl rand -hex 64
```

## Environment-Specific Behavior

The application behaves differently based on the NODE_ENV setting:

- **development**: Detailed error messages, verbose logging
- **production**: Generic error messages, optimized performance
- **test**: Special test database, reduced logging