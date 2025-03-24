// Set production environment and start the server
process.env.NODE_ENV = 'production';
import('./dist/index.js').catch(console.error);