import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Port configuration with fallbacks for Hostinger compatibility
const PORT = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080;
const HOST = process.env.HOST || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';

// Security logging
console.log('[STARTUP] Starting Autodesk Diagnosis Platform');
console.log('[STARTUP] Environment:', process.env.NODE_ENV || 'production');
console.log('[STARTUP] Configured PORT:', PORT);
console.log('[STARTUP] Configured HOST:', HOST);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'Server is running', 
    timestamp: new Date(),
    port: PORT
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    name: 'Autodesk Diagnosis Platform',
    version: '1.0.0',
    description: 'Plataforma de diagnostico IDI Method para soluciones Autodesk',
    status: 'operational',
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Autodesk Diagnosis Platform API',
    endpoints: {
      health: '/health',
      api: '/api'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// Graceful startup with error handling
const server = app.listen(PORT, HOST, () => {
  console.log(`[STARTUP] Server successfully bound to ${HOST}:${PORT}`);
  console.log(`[STARTUP] Health check: http://localhost:${PORT}/health`);
  console.log(`[STARTUP] API info: http://localhost:${PORT}/api`);
});

// Error handling for server startup failures
server.on('error', (err) => {
  console.error('[STARTUP_ERROR]', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
  if (err.code === 'EACCES') {
    console.error(`Permission denied to bind to ${HOST}:${PORT}`);
    process.exit(1);
  }
  throw err;
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] Received SIGTERM signal');
  server.close(() => {
    console.log('[SHUTDOWN] Server closed');
    process.exit(0);
  });
});
