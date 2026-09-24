/**
 * Autodesk Diagnosis Platform - Database Module
 * MySQL Connection & CRUD Operations
 * 
 * Maneja:
 * - Conexión a MySQL
 * - Operaciones CRUD para todas las tablas
 * - Queries optimizadas
 * - Error handling robusto
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { PRODUCTS, CHALLENGES } from './diagnosis-engine.js';

dotenv.config();

// Pool de conexiones a MySQL
let pool = null;

/**
 * Inicializar conexión a base de datos
 */
export async function initializeDatabase() {
  try {
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'autodesk_diagnosis',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };

    pool = mysql.createPool(dbConfig);

    // Test connection
    const connection = await pool.getConnection();
    console.log('[DATABASE] ✅ Conectado a MySQL exitosamente');
    connection.release();

    return pool;
  } catch (error) {
    console.error('[DATABASE_ERROR]', error.message);
    console.log('[DATABASE] Funcionando en modo memoria (sin BD)');
    pool = null;
    // Don't throw - allow graceful fallback to memory mode
    return null;
  }
}

/**
 * Obtener conexión del pool
 */
async function getConnection() {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  return await pool.getConnection();
}

// =====================================================
// CLIENTE OPERATIONS
// =====================================================

/**
 * Crear nuevo cliente
 */
export async function createClient(clientData) {
  if (!pool) return null;
  
  const conn = await getConnection();
  try {
    const [result] = await conn.execute(
      'INSERT INTO clients (name, company, industry, role, email, phone, country) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [clientData.name, clientData.company, clientData.industry, clientData.role, 
       clientData.email, clientData.phone, clientData.country]
    );
    return result.insertId;
  } finally {
    conn.release();
  }
}

/**
 * Obtener cliente por ID
 */
export async function getClient(clientId) {
  if (!pool) return null;
  
  const conn = await getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT * FROM clients WHERE id = ?',
      [clientId]
    );
    return rows[0] || null;
  } finally {
    conn.release();
  }
}

/**
 * Listar todos los clientes
 */
export async function listClients() {
  if (!pool) return [];
  
  const conn = await getConnection();
  try {
    const [rows] = await conn.execute('SELECT * FROM clients ORDER BY created_at DESC');
    return rows;
  } finally {
    conn.release();
  }
}

// =====================================================
// DIAGNOSIS OPERATIONS
// =====================================================

/**
 * Guardar diagnóstico completo
 */
export async function saveDiagnosis(diagnosis, clientId) {
  if (!pool) return null;
  
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    // Insertar diagnóstico principal
    const [diagResult] = await conn.execute(
      `INSERT INTO diagnoses 
       (client_id, maturity_level, maturity_score, total_roi_estimated, implementation_cost, 
        payback_period, roi_percentage, executive_summary, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientId,
        diagnosis.maturityAssessment.level,
        diagnosis.maturityAssessment.score,
        diagnosis.roi.estimatedAnnualROI,
        diagnosis.roi.estimatedImplementationCost,
        diagnosis.roi.paybackPeriod,
        diagnosis.roi.roiPercentage,
        JSON.stringify(diagnosis.executiveSummary),
        'completed'
      ]
    );

    const diagnosisId = diagResult.insertId;

    // Insertar productos seleccionados
    for (const productId of diagnosis.selectedProducts) {
      const product = PRODUCTS[productId];
      await conn.execute(
        'INSERT INTO diagnosis_products (diagnosis_id, product_id, product_name, product_category) VALUES (?, ?, ?, ?)',
        [diagnosisId, productId, product.name, product.category]
      );
    }

    // Insertar desafíos seleccionados
    for (const challengeId of diagnosis.selectedChallenges) {
      const challenge = CHALLENGES[challengeId];
      await conn.execute(
        'INSERT INTO diagnosis_challenges (diagnosis_id, challenge_id, challenge_name, challenge_category, challenge_impact) VALUES (?, ?, ?, ?, ?)',
        [diagnosisId, challengeId, challenge.name, challenge.category, challenge.impact]
      );
    }

    // Insertar recomendaciones
    for (let i = 0; i < diagnosis.recommendations.length; i++) {
      const rec = diagnosis.recommendations[i];
      const [recResult] = await conn.execute(
        `INSERT INTO recommendations 
         (diagnosis_id, rec_id, challenge_id, challenge_name, priority, category, estimated_roi, timeline, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          diagnosisId,
          rec.id,
          rec.challenge,
          rec.challenge,
          rec.priority,
          rec.category,
          rec.estimatedROI,
          rec.timeline,
          'pending'
        ]
      );

      // Insertar acciones de recomendación
      for (let j = 0; j < rec.actions.length; j++) {
        await conn.execute(
          'INSERT INTO recommendation_actions (recommendation_id, action_sequence, action_text, status) VALUES (?, ?, ?, ?)',
          [recResult.insertId, j + 1, rec.actions[j], 'pending']
        );
      }
    }

    // Insertar fases de implementación
    for (let i = 0; i < diagnosis.implementationPlan.phases.length; i++) {
      const phase = diagnosis.implementationPlan.phases[i];
      const [phaseResult] = await conn.execute(
        'INSERT INTO implementation_phases (diagnosis_id, phase_number, phase_name, phase_duration, status) VALUES (?, ?, ?, ?, ?)',
        [diagnosisId, i + 1, phase.phase, phase.duration, 'pending']
      );

      // Insertar actividades de la fase
      for (let j = 0; j < phase.activities.length; j++) {
        await conn.execute(
          'INSERT INTO phase_activities (phase_id, activity_sequence, activity_text, status) VALUES (?, ?, ?, ?)',
          [phaseResult.insertId, j + 1, phase.activities[j], 'pending']
        );
      }
    }

    // Insertar brechas de capacidad
    for (const gap of diagnosis.maturityAssessment.gaps) {
      await conn.execute(
        'INSERT INTO capability_gaps (diagnosis_id, challenge, coverage_percentage, recommendation, priority) VALUES (?, ?, ?, ?, ?)',
        [diagnosisId, gap.challenge, gap.coverage, gap.recommendation, 'medium']
      );
    }

    // Insertar métricas de éxito
    const metrics = diagnosis.executiveSummary.successMetrics;
    for (const metric of metrics) {
      await conn.execute(
        'INSERT INTO success_metrics (diagnosis_id, metric_name, metric_type, target_value, status) VALUES (?, ?, ?, ?, ?)',
        [diagnosisId, metric, 'custom', 'TBD', 'not_started']
      );
    }

    // Registrar en historial
    await conn.execute(
      'INSERT INTO diagnosis_history (diagnosis_id, event_type, event_description) VALUES (?, ?, ?)',
      [diagnosisId, 'created', 'Diagnóstico creado y almacenado exitosamente']
    );

    await conn.commit();
    console.log(`[DATABASE] Diagnóstico ${diagnosisId} guardado completamente`);
    return diagnosisId;

  } catch (error) {
    await conn.rollback();
    console.error('[DATABASE_ERROR]', error);
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Obtener diagnóstico completo con todas las relaciones
 */
export async function getDiagnosis(diagnosisId) {
  if (!pool) return null;
  
  const conn = await getConnection();
  try {
    // Diagnóstico principal
    const [diagRows] = await conn.execute(
      'SELECT d.*, c.name as client_name, c.company FROM diagnoses d LEFT JOIN clients c ON d.client_id = c.id WHERE d.id = ?',
      [diagnosisId]
    );

    if (diagRows.length === 0) return null;

    const diagnosis = diagRows[0];

    // Productos
    const [products] = await conn.execute(
      'SELECT * FROM diagnosis_products WHERE diagnosis_id = ?',
      [diagnosisId]
    );

    // Desafíos
    const [challenges] = await conn.execute(
      'SELECT * FROM diagnosis_challenges WHERE diagnosis_id = ?',
      [diagnosisId]
    );

    // Recomendaciones
    const [recommendations] = await conn.execute(
      'SELECT * FROM recommendations WHERE diagnosis_id = ?',
      [diagnosisId]
    );

    // Fases
    const [phases] = await conn.execute(
      'SELECT * FROM implementation_phases WHERE diagnosis_id = ?',
      [diagnosisId]
    );

    return {
      ...diagnosis,
      products,
      challenges,
      recommendations,
      phases
    };
  } finally {
    conn.release();
  }
}

/**
 * Listar diagnósticos con filtrado
 */
export async function listDiagnoses(filters = {}) {
  if (!pool) return [];
  
  const conn = await getConnection();
  try {
    let query = `
      SELECT d.id, d.diagnosis_date, c.name as client_name, c.company, c.industry,
             d.maturity_level, d.maturity_score, d.total_roi_estimated, 
             d.implementation_cost, d.status,
             COUNT(DISTINCT r.id) as recommendation_count
      FROM diagnoses d
      LEFT JOIN clients c ON d.client_id = c.id
      LEFT JOIN recommendations r ON d.id = r.diagnosis_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.company) {
      query += ' AND c.company LIKE ?';
      params.push(`%${filters.company}%`);
    }

    if (filters.industry) {
      query += ' AND c.industry = ?';
      params.push(filters.industry);
    }

    if (filters.priority) {
      query += ' AND EXISTS (SELECT 1 FROM recommendations WHERE diagnosis_id = d.id AND priority = ?)';
      params.push(filters.priority);
    }

    query += ' GROUP BY d.id ORDER BY d.diagnosis_date DESC';

    const [rows] = await conn.execute(query, params);
    return rows;
  } finally {
    conn.release();
  }
}

/**
 * Actualizar estado de diagnóstico
 */
export async function updateDiagnosisStatus(diagnosisId, status, notes = null) {
  if (!pool) return false;
  
  const conn = await getConnection();
  try {
    await conn.execute(
      'UPDATE diagnoses SET status = ?, consultant_notes = ? WHERE id = ?',
      [status, notes, diagnosisId]
    );

    // Registrar en historial
    await conn.execute(
      'INSERT INTO diagnosis_history (diagnosis_id, event_type, event_description) VALUES (?, ?, ?)',
      [diagnosisId, 'status_change', `Estado cambiado a: ${status}`]
    );

    return true;
  } finally {
    conn.release();
  }
}

// =====================================================
// ANALYTICS & REPORTING
// =====================================================

/**
 * Obtener estadísticas de diagnósticos
 */
export async function getDiagnosisStats() {
  if (!pool) return null;
  
  const conn = await getConnection();
  try {
    const [stats] = await conn.execute(`
      SELECT 
        COUNT(*) as total_diagnoses,
        COUNT(DISTINCT client_id) as unique_clients,
        AVG(total_roi_estimated) as avg_roi,
        AVG(maturity_score) as avg_maturity,
        SUM(total_roi_estimated) as total_roi_value
      FROM diagnoses
      WHERE status = 'completed'
    `);

    return stats[0];
  } finally {
    conn.release();
  }
}

/**
 * Obtener desafíos más comunes
 */
export async function getCommonChallenges() {
  if (!pool) return [];
  
  const conn = await getConnection();
  try {
    const [rows] = await conn.execute(`
      SELECT challenge_name, COUNT(*) as frequency, COUNT(DISTINCT diagnosis_id) as diagnosis_count
      FROM diagnosis_challenges
      GROUP BY challenge_name
      ORDER BY frequency DESC
      LIMIT 10
    `);

    return rows;
  } finally {
    conn.release();
  }
}

/**
 * Obtener productos más utilizados
 */
export async function getMostUsedProducts() {
  if (!pool) return [];
  
  const conn = await getConnection();
  try {
    const [rows] = await conn.execute(`
      SELECT product_name, COUNT(*) as frequency, COUNT(DISTINCT diagnosis_id) as diagnosis_count
      FROM diagnosis_products
      GROUP BY product_name
      ORDER BY frequency DESC
      LIMIT 6
    `);

    return rows;
  } finally {
    conn.release();
  }
}

/**
 * Obtener diagnósticos por período
 */
export async function getDiagnosesByPeriod(days = 30) {
  if (!pool) return [];
  
  const conn = await getConnection();
  try {
    const [rows] = await conn.execute(`
      SELECT 
        DATE(diagnosis_date) as date,
        COUNT(*) as count,
        AVG(total_roi_estimated) as avg_roi
      FROM diagnoses
      WHERE diagnosis_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(diagnosis_date)
      ORDER BY date DESC
    `, [days]);

    return rows;
  } finally {
    conn.release();
  }
}

/**
 * Cerrar pool de conexiones
 */
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    console.log('[DATABASE] Pool de conexiones cerrado');
  }
}

export default {
  initializeDatabase,
  createClient,
  getClient,
  listClients,
  saveDiagnosis,
  getDiagnosis,
  listDiagnoses,
  updateDiagnosisStatus,
  getDiagnosisStats,
  getCommonChallenges,
  getMostUsedProducts,
  getDiagnosesByPeriod,
  closeDatabase
};
