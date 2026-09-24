import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { generateDiagnosis, PRODUCTS, CHALLENGES } from './diagnosis-engine.js';
import {
  initializeDatabase,
  createClient,
  saveDiagnosis,
  getDiagnosis,
  listDiagnoses,
  closeDatabase
} from './db.js';

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

// Database configuration
let dbReady = false;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// =====================================================
// HEALTH & INFO ENDPOINTS
// =====================================================

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'Server is running',
    timestamp: new Date(),
    port: PORT,
    database_ready: dbReady,
    database_status: dbReady ? 'connected' : 'pending'
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    name: 'Autodesk Diagnosis Platform',
    version: '1.0.0',
    description: 'Plataforma de diagnóstico IDI Method para soluciones Autodesk',
    status: 'operational',
    uptime: process.uptime(),
    endpoints: {
      '/health': 'Health check',
      '/api': 'API info',
      'POST /api/diagnosis': 'Generate diagnosis',
      'GET /api/diagnoses': 'List all diagnoses',
      'GET /api/diagnoses/:id': 'Get specific diagnosis',
      'GET /api/products': 'List Autodesk products',
      'GET /api/challenges': 'List business challenges'
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.sendFile(new URL('./index.html', import.meta.url).pathname);
});

// Serve static files
app.use(express.static(new URL('.', import.meta.url).pathname));

// =====================================================
// DIAGNOSIS ENDPOINTS
// =====================================================

/**
 * POST /api/diagnosis
 * Generate a new diagnosis from client input
 */
app.post('/api/diagnosis', async (req, res) => {
  try {
    console.log('[DIAGNOSIS] Generating new diagnosis...');

    // Validate input
    if (!req.body.clientName || !req.body.companyName) {
      return res.status(400).json({
        error: 'Missing required fields: clientName, companyName',
        code: 'INVALID_INPUT'
      });
    }

    if (!Array.isArray(req.body.products) || req.body.products.length === 0) {
      return res.status(400).json({
        error: 'At least one product must be selected',
        code: 'NO_PRODUCTS_SELECTED'
      });
    }

    if (!Array.isArray(req.body.challenges) || req.body.challenges.length === 0) {
      return res.status(400).json({
        error: 'At least one challenge must be selected',
        code: 'NO_CHALLENGES_SELECTED'
      });
    }

    // Generate diagnosis
    const diagnosis = generateDiagnosis(req.body);

    // Create or retrieve client
    let clientId = null;
    if (dbReady) {
      try {
        clientId = await createClient({
          name: req.body.clientName,
          company: req.body.companyName,
          industry: req.body.industry || 'Unknown',
          role: req.body.role || 'Unknown',
          email: req.body.clientEmail || '',
          phone: req.body.clientPhone || '',
          country: req.body.country || 'Unknown'
        });
      } catch (dbError) {
        console.error('[DIAGNOSIS] Database error creating client:', dbError.message);
        clientId = 1; // Fallback to default client ID
      }
    } else {
      clientId = 1; // Fallback when database is not ready
    }

    // Save diagnosis to database
    let diagnosisId = null;
    if (dbReady) {
      try {
        diagnosisId = await saveDiagnosis(diagnosis, clientId);
        console.log(`[DIAGNOSIS] Saved to database with ID: ${diagnosisId}`);
      } catch (dbError) {
        console.error('[DIAGNOSIS] Database error saving diagnosis:', dbError.message);
        // Continue with in-memory response even if database fails
      }
    }

    console.log(`[DIAGNOSIS] Generated diagnosis successfully`);

    res.status(201).json({
      success: true,
      diagnosis: diagnosis,
      diagnosisId: diagnosisId,
      clientId: clientId,
      databaseStored: diagnosisId !== null,
      message: 'Diagnosis generated successfully'
    });

  } catch (error) {
    console.error('[DIAGNOSIS_ERROR]', error);
    res.status(500).json({
      error: 'Error generating diagnosis',
      message: error.message,
      code: 'DIAGNOSIS_GENERATION_ERROR'
    });
  }
});

/**
 * GET /api/diagnoses
 * Retrieve all diagnoses with optional filtering
 */
app.get('/api/diagnoses', async (req, res) => {
  try {
    const { company, industry, priority } = req.query;

    let diagnosesList = [];

    if (dbReady) {
      try {
        // Build filters object
        const filters = {};
        if (company) filters.company = company;
        if (industry) filters.industry = industry;
        if (priority) filters.priority = priority;

        diagnosesList = await listDiagnoses(filters);
      } catch (dbError) {
        console.error('[ERROR] Database query failed:', dbError.message);
        diagnosesList = [];
      }
    }

    res.status(200).json({
      success: true,
      count: diagnosesList.length,
      database_source: dbReady,
      diagnoses: diagnosesList.map(d => ({
        id: d.id,
        clientName: d.client_name,
        company: d.company,
        industry: d.industry,
        diagnosisDate: d.diagnosis_date,
        maturityLevel: d.maturity_level,
        maturityScore: d.maturity_score,
        totalROI: d.total_roi_estimated,
        implementationCost: d.implementation_cost,
        recommendationCount: d.recommendation_count,
        status: d.status
      }))
    });

  } catch (error) {
    console.error('[ERROR] Retrieving diagnoses:', error);
    res.status(500).json({
      error: 'Error retrieving diagnoses',
      message: error.message
    });
  }
});

/**
 * GET /api/diagnoses/:id
 * Retrieve specific diagnosis by ID
 */
app.get('/api/diagnoses/:id', async (req, res) => {
  try {
    let diagnosis = null;

    if (dbReady) {
      try {
        diagnosis = await getDiagnosis(req.params.id);
      } catch (dbError) {
        console.error('[ERROR] Database query failed:', dbError.message);
      }
    }

    if (!diagnosis) {
      return res.status(404).json({
        error: 'Diagnosis not found',
        id: req.params.id
      });
    }

    res.status(200).json({
      success: true,
      diagnosis: diagnosis
    });

  } catch (error) {
    console.error('[ERROR] Retrieving diagnosis:', error);
    res.status(500).json({
      error: 'Error retrieving diagnosis',
      message: error.message
    });
  }
});

// =====================================================
// REFERENCE DATA ENDPOINTS
// =====================================================

/**
 * GET /api/products
 * List all available Autodesk products
 */
app.get('/api/products', (req, res) => {
  try {
    const productsList = Object.entries(PRODUCTS).map(([id, product]) => ({
      id: id,
      name: product.name,
      category: product.category,
      capabilities: product.capabilities,
      industries: product.industry
    }));

    res.status(200).json({
      success: true,
      count: productsList.length,
      products: productsList
    });

  } catch (error) {
    console.error('[ERROR] Retrieving products:', error);
    res.status(500).json({
      error: 'Error retrieving products',
      message: error.message
    });
  }
});

/**
 * GET /api/challenges
 * List all business challenges
 */
app.get('/api/challenges', (req, res) => {
  try {
    const challengesList = Object.entries(CHALLENGES).map(([id, challenge]) => ({
      id: id,
      name: challenge.name,
      category: challenge.category,
      impact: challenge.impact,
      weight: challenge.weight
    }));

    res.status(200).json({
      success: true,
      count: challengesList.length,
      challenges: challengesList
    });

  } catch (error) {
    console.error('[ERROR] Retrieving challenges:', error);
    res.status(500).json({
      error: 'Error retrieving challenges',
      message: error.message
    });
  }
});

// =====================================================
// ERROR HANDLERS
// =====================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    hint: 'See GET /api for available endpoints'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// =====================================================
// SERVER STARTUP
// =====================================================

async function startServer() {
  // Initialize database
  try {
    console.log('[STARTUP] Initializing database...');
    const dbPool = await initializeDatabase();
    if (dbPool) {
      dbReady = true;
      console.log('[STARTUP] ✅ Database initialized successfully');
    } else {
      dbReady = false;
      console.log('[STARTUP] ⚠️ Database not available - using memory mode');
    }
  } catch (error) {
    console.error('[STARTUP] ⚠️ Database initialization error:', error.message);
    console.log('[STARTUP] Continuing in memory-only mode');
    dbReady = false;
  }

  // Start Express server
  const server = app.listen(PORT, HOST, () => {
    console.log(`[STARTUP] ✅ Server successfully bound to ${HOST}:${PORT}`);
    console.log(`[STARTUP] Database mode: ${dbReady ? 'MySQL (persistent)' : 'Memory (development)'}`);
    console.log(`[STARTUP] Health check: http://localhost:${PORT}/health`);
    console.log(`[STARTUP] API documentation: http://localhost:${PORT}/api`);
    console.log(`[STARTUP] Diagnosis form: http://localhost:${PORT}/`);
    console.log(`[STARTUP] Portal: http://localhost:${PORT}/consultant-portal.html`);
  });

  return server;
}

// Start the server
let server = null;
startServer().then(srv => {
  server = srv;

  // Error handling for server startup failures
  server.on('error', (err) => {
    console.error('[SERVER_ERROR]', err.message);
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use`);
      process.exit(1);
    }
    if (err.code === 'EACCES') {
      console.error(`❌ Permission denied to bind to ${HOST}:${PORT}`);
      process.exit(1);
    }
    throw err;
  });
}).catch(err => {
  console.error('[STARTUP_ERROR] Failed to start server:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[SHUTDOWN] Received SIGTERM signal');

  // Close database connection
  if (dbReady) {
    try {
      await closeDatabase();
      console.log('[SHUTDOWN] ✅ Database connection closed');
    } catch (err) {
      console.error('[SHUTDOWN] Error closing database:', err.message);
    }
  }

  // Close server
  if (server) {
    server.close(() => {
      console.log('[SHUTDOWN] ✅ Server closed gracefully');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT_EXCEPTION]', err);
  process.exit(1);
});
