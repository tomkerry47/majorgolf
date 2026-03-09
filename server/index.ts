try {
  await import('dotenv/config');
} catch {
  // Production can rely on platform-provided environment variables.
}
import express, { type Request, Response, NextFunction } from "express";
import cookieParser from 'cookie-parser'; // Import cookie-parser
import cors from 'cors'; // Import cors
import { registerRoutes } from "./routes";
import { setupVite, log } from "./vite"; // Remove serveStatic import
import fs from "fs"; // Import fs for checking directory existence
import path from "path";
import { fileURLToPath } from "url";

// Set NODE_ENV if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development";
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- CORS Configuration ---
// Allow requests from the Vite dev server, local backend, and the deployed Azure App Service URL
const allowedOrigins = [
  'http://127.0.0.1:5173', 
  'http://localhost:5173', 
  'http://127.0.0.1:5000', 
  'http://localhost:5000', 
  'http://127.0.0.1:5001', 
  'http://localhost:5001',
  'https://majorpredictor-g5g7f2h3e7csercc.uksouth-01.azurewebsites.net' // Add deployed URL
];
const corsOptions: cors.CorsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // Ensure PATCH and PUT are allowed
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow necessary headers
  credentials: true // Allow cookies/credentials
};
app.use(cors(corsOptions));
// Handle preflight requests explicitly for all routes
app.options('*', cors(corsOptions));
// --- End CORS Configuration ---

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser()); // Use cookie-parser middleware

// Add a simple health check endpoint
app.get('/healthz', (req, res) => {
  res.sendStatus(200); // Send 'OK' status
});

// Removed early debug logging

// Serve static files from the 'public' directory (including uploads)
const publicPath = path.join(__dirname, '../public');
// console.log(`[Static Files] Serving static files from: ${publicPath}`); // Log removed
app.use(express.static(publicPath));


// Add a test endpoint that returns simple HTML
app.get('/test', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Golf Syndicate Tracker - Test Page</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; background-color: #f0f9ff; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #0369a1; }
        button { background-color: #0ea5e9; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
        pre { background-color: #f1f5f9; padding: 10px; border-radius: 4px; overflow: auto; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Golf Syndicate Tracker - Test Page</h1>
        <p>This is a test page to verify the server is working correctly.</p>
        <p>Current time: ${new Date().toLocaleString()}</p>
        
        <h2>API Test</h2>
        <button id="testBtn">Test API Connection</button>
        <div id="results" style="margin-top: 16px;"></div>
        
        <script>
          document.getElementById('testBtn').addEventListener('click', async () => {
            const resultsDiv = document.getElementById('results');
            resultsDiv.innerHTML = '<p>Testing API connection...</p>';
            
            try {
              const response = await fetch('/api/competitions');
              const data = await response.json();
              
              resultsDiv.innerHTML = '<p>API connection successful!</p>';
              resultsDiv.innerHTML += '<p>Status: ' + response.status + '</p>';
              resultsDiv.innerHTML += '<p>Data:</p><pre>' + JSON.stringify(data, null, 2) + '</pre>';
            } catch (error) {
              resultsDiv.innerHTML = '<p>API connection failed: ' + error.message + '</p>';
            }
          });
        </script>
      </div>
    </body>
    </html>
  `);
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  console.log("[Server Startup] Starting async IIFE..."); // Added log
  
  console.log("[Server Startup] Registering routes..."); // Added log
  const server = await registerRoutes(app);
  console.log("[Server Startup] Routes registered."); // Added log

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Server error:", err);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  console.log("Current env:", app.get("env"));
  console.log("Node ENV:", process.env.NODE_ENV);
  
  if (app.get("env") === "development") {
    console.log("[Server Startup] Setting up Vite in development mode..."); // Updated log
    try {
      await setupVite(app, server);
      console.log("[Server Startup] Vite setup completed successfully."); // Updated log
    } catch (error) {
      console.error("[Server Startup] Error during Vite setup:", error); // Updated log
    }
  } else {
    console.log("Setting up static serving in production mode");
    // --- Production Static Serving Logic ---
    const distPath = path.resolve(__dirname, "public"); // dist/public relative to project root
    console.log(`[Production Static] Calculated distPath: ${distPath}`); // Log the calculated path
    if (!fs.existsSync(distPath)) {
      // Log error and potentially exit or throw, as the app can't serve the frontend
      console.error(`Build directory not found at: ${distPath}. Cannot serve static assets.`);
      // Optionally: process.exit(1); or throw new Error(...)
    } else {
      // Serve static assets (CSS, JS, images) from dist/public
      app.use(express.static(distPath));

      // SPA Fallback: Handle client-side routing by serving index.html for non-API GET requests
      app.get('*', (req, res, next) => {
        // If the request path starts with /api/, it's an API request, let it fall through (to 404 eventually if not matched)
        if (req.originalUrl.startsWith('/api/')) {
          return next();
        }
        // If the request accepts HTML, serve index.html
        if (req.accepts('html')) {
          res.sendFile(path.resolve(distPath, 'index.html'), (err) => {
            // Handle potential errors sending the file (e.g., file not found)
            if (err) {
              console.error("Error sending index.html:", err);
              next(err); // Pass error to the main error handler
            }
          });
        } else {
          // For non-HTML requests that didn't match static files (e.g., missing images), let them fall through
          next();
        }
      });
    }
    // --- End Production Static Serving Logic ---
  }


  // Use PORT from environment variable if available, otherwise default to 5000
  // this serves both the API and the client.
  const port = parseInt(process.env.PORT || "5000", 10);
  console.log(`[Server Startup] Attempting to listen on ${port}...`); // Added log
  server.listen({
    port,
    host: "0.0.0.0", // Listen on all available interfaces for container environments
    // reusePort: true, // Removed reusePort option
  }, () => {
    log(`serving on port ${port}`); // Keep existing log
    console.log(`[Server Startup] Server is running at http://127.0.0.1:${port}`); // Updated log
    // Removed the 'Access from outside' log as it's less relevant for localhost
    console.log(`[Server Startup] Test page available at http://127.0.0.1:${port}/test`); // Updated log
  });
})();
