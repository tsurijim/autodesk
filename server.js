import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'Server is running', timestamp: new Date() });
});

// API info endpoint
app.get('/api', (req, res) => {
    res.status(200).json({
          name: 'Autodesk Diagnosis Platform',
          version: '1.0.0',
          description: 'Plataforma de diagnostico IDI Method para soluciones Autodesk',
          status: 'operational'
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
    console.error('Error:', err);
    res.status(500).json({
          error: 'Internal server error',
          message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`API info: http://localhost:${PORT}/api`);
});404: Not Found
