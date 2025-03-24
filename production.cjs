#!/usr/bin/env node

/**
 * This is a production start script for the Golf Syndicate Tracker
 * It sets the NODE_ENV to production and launches the server
 */

// Set environment to production
process.env.NODE_ENV = 'production';
// When deploying to Replit, we'll use port 3000 for production
// The environment will provide the PORT if needed, otherwise default to 3000
process.env.PORT = process.env.PORT || '3000';
console.log('Starting server in production mode...');
console.log('NODE_ENV set to:', process.env.NODE_ENV);
console.log('PORT set to:', process.env.PORT);

// Simple wrapper to import ESM module from CommonJS
async function startServer() {
  try {
    console.log('Loading server from dist/index.js...');
    // Import the ESM module
    await import('./dist/index.js');
    console.log('Server loaded successfully.');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch(err => {
  console.error('Unexpected error during server startup:', err);
  process.exit(1);
});