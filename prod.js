// Production build and start script
const { execSync } = require('child_process');

try {
  console.log('Building application...');
  execSync('npm run build', { stdio: 'inherit' });
  
  console.log('Starting application in production mode...');
  
  // Set NODE_ENV before importing the production bundle
  process.env.NODE_ENV = 'production';
  require('./dist/index.js');
} catch (error) {
  console.error('Error during build or start:', error);
  process.exit(1);
}