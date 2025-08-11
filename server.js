const express = require('express');
const { validateEnvironment, config } = require('./src/config/env');
const app = require('./src/app');
const path = require('path');

// Validate environment variables on startup
try {
  validateEnvironment();
} catch (error) {
  console.error('❌ Environment validation failed:', error.message);
  process.exit(1);
}

const PORT = config.port;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Fitness Tracker server running on port ${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
  console.log(`🌐 Frontend available at http://localhost:${PORT}`);
  console.log(`🧪 Test coverage available at http://localhost:${PORT}/coverage`);
  console.log(`🔧 Environment: ${config.nodeEnv}`);
  console.log(`🔐 JWT Secret configured: ${config.jwtSecret ? 'Yes' : 'No'}`);
}); 