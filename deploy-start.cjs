#!/usr/bin/env node

/**
 * This is a deployment start script for the Golf Syndicate Tracker
 * It's specifically designed for the Replit deployment process.
 */

// Set environment to production for deployment
process.env.NODE_ENV = 'production';
console.log('Starting server for deployment...');
console.log('NODE_ENV set to:', process.env.NODE_ENV);
console.log('Using default PORT provided by Replit deployment');

// Simple wrapper to import ESM module from CommonJS
async function startServer() {
  try {
    console.log('Loading server from dist/index.js...');
    // Import the ESM module
    await import('./dist/index.js');
    console.log('Server loaded successfully for deployment.');
  } catch (error) {
    console.error('Failed to start deployment server:', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch(err => {
  console.error('Unexpected error during deployment server startup:', err);
  process.exit(1);
});