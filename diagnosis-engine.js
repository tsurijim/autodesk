/**
 * Motor de diagnóstico Autodesk (IDI Method)
 *
 * Contrato con server.js y db.js:
 *   - generateDiagnosis(input) -> objeto con maturityAssessment, roi, executiveSummary,
 *     selectedProducts, selectedChallenges, recommendations e implementationPlan.
 *   - PRODUCTS y CHALLENGES son objetos indexados por id (server.js usa Object.entries
 *     y db.js hace PRODUCTS[id].name / CHALLENGES[id].category).
 *
 * IMPORTANTE: los importes de ROI y costo son parámetros de referencia para estimar
 * orden de magnitud. Deben validarse con el consultor antes de presentarlos al cliente.
 */

export const PRODUCTS = {
  1: { name: 'Revit', category: 'BIM' },
  2: { name: 'AutoCAD', category: 'CAD' },
  3: { name: 'Navisworks', category: 'Gestión de Proyectos' },
  4: { name: 'Fusion 360', category: 'Diseño' },
  5: { name: 'Inventor', category: 'Diseño Mecánico' },
  6: { name: 'Construction Cloud', category: 'Colaboración en la Nube' }
};

export const CHALLENGES = {
  1: { name: 'Eficiencia', category: 'Operaciones', impact: 'High', weight: 1.5,
       recommendations: ['Automatizar tareas repetitivas de documentación', 'Estandarizar plantillas y estilos en Revit/AutoCAD', 'Medir tiempo de ciclo por entregable'] },
  2: { name: 'Colaboración', category: 'Colaboración', impact: 'High', weight: 1.4,
       recommendations: ['Centralizar modelos en un entorno común de datos', 'Definir flujos de coordinación y revisiones periódicas', 'Implementar detección de interferencias con Navisworks'] },
  3: { name: 'Costo', category: 'Financiero', impact: 'High', weight: 1.5,
       recommendations: ['Implementar control de costos con modelos 5D', 'Reducir retrabajo mediante coordinación temprana', 'Revisar licenciamiento y uso real de software'] },
  4: { name: 'Calidad', category: 'Calidad', impact: 'Medium', weight: 1.2,
       recommendations: ['Establecer estándares de calidad y revisión de modelos (LOD)', 'Implementar validación automática de datos', 'Capacitar al equipo en estándares ISO 19650'] },
  5: { name: 'Cronograma', category: 'Planeación', impact: 'High', weight: 1.3,
       recommendations: ['Implementar planeación 4D vinculada al modelo', 'Monitorear avance en tiempo real', 'Anticipar conflictos de secuencia antes de obra'] },
  6: { name: 'Cumplimiento', category: 'Cumplimiento', impact: 'Medium', weight: 1.1,
       recommendations: ['Documentar cumplimiento normativo en el modelo', 'Auditar entregables contra la normatividad aplicable', 'Definir responsables de cumplimiento por proyecto'] }
};

// Parámetros de referencia (USD) para estimaciones. Ajustar con el consultor.
const COST_PER_PRODUCT = 15000;
const COST_PER_CHALLENGE = 8000;
const BENEFIT_PER_CHALLENGE = 25000;
const BENEFIT_PER_PRODUCT = 10000;

// Alias de entrada: el formulario web envía nombres; la API también acepta ids.
const PRODUCT_ALIASES = {
  'autodesk revit': 1,
};
for (const [id, p] of Object.entries(PRODUCTS)) {
  PRODUCT_ALIASES[p.name.toLowerCase()] = Number(id);
}

const CHALLENGE_ALIASES = {};
for (const [id, c] of Object.entries(CHALLENGES)) {
  CHALLENGE_ALIASES[c.name.toLowerCase()] = Number(id);
}

function resolveIds(values, aliases, catalog, label) {
  const list = Array.isArray(values) ? values : [];
  const ids = new Set();
  for (const raw of list) {
    if (raw === null || raw === undefined) continue;
    const key = String(raw).trim().toLowerCase();
    if (aliases[key] !== undefined) { ids.add(aliases[key]); continue; }
    if (catalog[Number(raw)] !== undefined) { ids.add(Number(raw)); continue; }
  }
  if (ids.size === 0) {
    throw new Error(`Ningún ${label} válido fue recibido`);
  }
  return [...ids];
}

function maturityLevel(score) {
  if (score < 40) return 'Inicial';
  if (score < 60) return 'En desarrollo';
  if (score < 80) return 'Avanzado';
  return 'Optimizado';
}

export function generateDiagnosis(input = {}) {
  const selectedProducts = resolveIds(input.products, PRODUCT_ALIASES, PRODUCTS, 'producto');
  const selectedChallenges = resolveIds(input.challenges, CHALLENGE_ALIASES, CHALLENGES, 'desafío');

  const nP = selectedProducts.length;
  const nC = selectedChallenges.length;
  const challengeWeight = selectedChallenges.reduce((s, id) => s + CHALLENGES[id].weight, 0);

  // Madurez: más productos adoptados suman; más desafíos abiertos restan.
  const rawScore = 35 + nP * 6 - challengeWeight * 4;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  // ROI estimado
  const implementationCost = COST_PER_PRODUCT * nP + COST_PER_CHALLENGE * nC;
  const annualBenefit = BENEFIT_PER_CHALLENGE * nC + BENEFIT_PER_PRODUCT * nP;
  const paybackMonths = annualBenefit > 0 ? Math.round((implementationCost / annualBenefit) * 12 * 10) / 10 : 0;
  const roiPercentage = implementationCost > 0
    ? Math.round(((annualBenefit - implementationCost) / implementationCost) * 100)
    : 0;

  const productNames = selectedProducts.map(id => PRODUCTS[id].name);
  const challengeNames = selectedChallenges.map(id => CHALLENGES[id].name);

  const gaps = selectedChallenges.map(id => ({
    challenge: CHALLENGES[id].name,
    coverage: Math.max(0, Math.min(100, 100 - score)),
    recommendation: CHALLENGES[id].recommendations[0]
  }));

  const recommendations = selectedChallenges.map((id, idx) => {
    const c = CHALLENGES[id];
    const high = c.impact === 'High';
    return {
      id: `REC-${String(idx + 1).padStart(2, '0')}`,
      challenge: c.name,
      priority: high ? 'Alta' : 'Media',
      category: c.category,
      estimatedROI: BENEFIT_PER_CHALLENGE,
      timeline: high ? '1-3 meses' : '3-6 meses',
      actions: c.recommendations
    };
  });

  const highCount = recommendations.filter(r => r.priority === 'Alta').length;

  const implementationPlan = {
    phases: [
      {
        phase: 'Fase 1: Diagnóstico y preparación',
        duration: '4-6 semanas',
        activities: ['Validar línea base de procesos actuales', 'Definir estándares y responsables', 'Capacitación inicial del equipo']
      },
      {
        phase: 'Fase 2: Implementación de flujos prioritarios',
        duration: '2-4 meses',
        activities: [`Implementar recomendaciones de prioridad alta (${highCount})`, 'Configurar entorno de datos compartido', 'Medir indicadores de avance']
      },
      {
        phase: 'Fase 3: Optimización y escalamiento',
        duration: '3-6 meses',
        activities: ['Extender flujos a otros proyectos', 'Auditoría de resultados contra métricas', 'Plan de mejora continua']
      }
    ]
  };

  const successMetrics = [
    'Reducción del tiempo de ciclo de entregables',
    'Disminución de retrabajo y conflictos detectados en obra',
    'Adopción de productos seleccionados por el equipo'
  ];

  const level = maturityLevel(score);

  return {
    client: {
      name: input.clientName || '',
      company: input.companyName || '',
      industry: input.industry || 'Desconocida',
      role: input.role || 'Desconocida',
      email: input.clientEmail || '',
      phone: input.clientPhone || '',
      country: input.country || 'Desconocida'
    },
    selectedProducts,
    selectedChallenges,
    productNames,
    challengeNames,
    maturityAssessment: {
      level,
      score,
      gaps
    },
    roi: {
      estimatedAnnualROI: annualBenefit,
      estimatedImplementationCost: implementationCost,
      paybackPeriod: paybackMonths,
      roiPercentage
    },
    executiveSummary: {
      summary: `Nivel de madurez ${level} (${score}/100). Productos evaluados: ${productNames.join(', ')}. Desafíos prioritarios: ${challengeNames.join(', ')}.`,
      keyFindings: challengeNames.map(n => `Desafío identificado: ${n}`),
      successMetrics
    },
    recommendations,
    implementationPlan,
    generatedAt: new Date().toISOString()
  };
}
