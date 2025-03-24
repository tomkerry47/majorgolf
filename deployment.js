// Cross-platform script to run in production mode
process.env.NODE_ENV = 'production';

// Import the server in production mode
import('./dist/index.js').catch(err => {
  console.error('Error starting production server:', err);
  process.exit(1);
});