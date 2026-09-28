export const PRODUCTS = [
  { id: 1, name: 'Revit', category: 'BIM', version: '2024' },
  { id: 2, name: 'AutoCAD', category: 'CAD', version: '2024' },
  { id: 3, name: 'Navisworks', category: 'Project Management', version: '2024' },
  { id: 4, name: 'Fusion 360', category: 'Design', version: 'Latest' }
];

export const CHALLENGES = [
  { id: 1, name: 'Data Integration', impact: 'High', severity: 'Critical' },
  { id: 2, name: 'User Adoption', impact: 'Medium', severity: 'Important' },
  { id: 3, name: 'Process Optimization', impact: 'High', severity: 'Critical' },
  { id: 4, name: 'Workflow Automation', impact: 'Medium', severity: 'Important' },
  { id: 5, name: 'Data Quality', impact: 'High', severity: 'Critical' }
];

function calculateScore(responses) {
  if (!responses || responses.length === 0) return 0;
  const totalWeight = responses.reduce((sum, r) => sum + (r.weight || 1), 0);
  const totalScore = responses.reduce((sum, r) => sum + ((r.value || 0) * (r.weight || 1)), 0);
  return Math.round((totalScore / totalWeight) * 100) / 100;
}

function generateRecommendations(score, responses) {
  const recommendations = [];
  if (score < 30) {
    recommendations.push({
      priority: 'Critical',
      action: 'Implementar mejoras inmediatas en infraestructura',
      timeline: 'Inmediato'
    });
  } else if (score < 60) {
    recommendations.push({
      priority: 'High',
      action: 'Optimizar flujos de trabajo existentes',
      timeline: '1-3 meses'
    });
  } else {
    recommendations.push({
      priority: 'Medium',
      action: 'Mantener y monitorear mejoras actuales',
      timeline: 'Continuo'
    });
  }
  return recommendations;
}

export async function generateDiagnosis(userId, responses) {
  const score = calculateScore(responses);
  const recommendations = generateRecommendations(score, responses);
  try {
    const db = (await import('./db.js')).default;
    await db.query(
      'INSERT INTO diagnosis_results (user_id, score, recommendations, created_at) VALUES (?, ?, ?, NOW())',
      [userId, score, JSON.stringify(recommendations)]
    );
  } catch (err) {
    console.error('Error saving diagnosis:', err);
  }
  return { score, recommendations };
}
