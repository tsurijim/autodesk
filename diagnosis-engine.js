// Diagnosis Engine - Core business logic for Autodesk IDI diagnosis platform
// This module handles the core diagnosis methodology and evaluation logic

class DiagnosisEngine {
  constructor(database) {
    this.database = database;
    this.evaluationResults = {};
    this.diagnosticQuestions = [];
  }

  /**
   * Initialize the diagnosis engine with assessment data
   */
  async initialize() {
    try {
      // Load diagnostic questions from database
      this.diagnosticQuestions = await this.loadDiagnosticQuestions();
      console.log('DiagnosisEngine initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing DiagnosisEngine:', error);
      return false;
    }
  }

  /**
   * Load diagnostic questions from the database
   */
  async loadDiagnosticQuestions() {
    try {
      const query = 'SELECT * FROM diagnostic_questions ORDER BY question_order';
      const questions = await this.database.query(query);
      return questions;
    } catch (error) {
      console.error('Error loading diagnostic questions:', error);
      return [];
    }
  }

  /**
   * Process diagnosis responses and generate evaluation
   */
  async processDiagnosis(responses) {
    try {
      const evaluation = {
        timestamp: new Date(),
        responses: responses,
        score: 0,
        recommendations: []
      };

      // Calculate diagnosis score based on IDI methodology
      evaluation.score = this.calculateDiagnosisScore(responses);
      evaluation.recommendations = this.generateRecommendations(evaluation.score);

      // Store evaluation results
      this.evaluationResults = evaluation;

      return evaluation;
    } catch (error) {
      console.error('Error processing diagnosis:', error);
      return null;
    }
  }

  /**
   * Calculate diagnosis score using IDI methodology
   */
  calculateDiagnosisScore(responses) {
    if (!responses || Object.keys(responses).length === 0) {
      return 0;
    }

    let totalScore = 0;
    let responseCount = 0;

    for (const [questionId, response] of Object.entries(responses)) {
      if (response && typeof response.value === 'number') {
        totalScore += response.value;
        responseCount++;
      }
    }

    return responseCount > 0 ? Math.round((totalScore / responseCount) * 100) / 100 : 0;
  }

  /**
   * Generate recommendations based on diagnosis score
   */
  generateRecommendations(score) {
    const recommendations = [];

    if (score >= 80) {
      recommendations.push('Excelent alignment with IDI methodology');
      recommendations.push('Continue with current implementation strategy');
    } else if (score >= 60) {
      recommendations.push('Good alignment but opportunities for improvement');
      recommendations.push('Review key methodology areas');
    } else if (score >= 40) {
      recommendations.push('Significant alignment gaps identified');
      recommendations.push('Recommend implementing corrective actions');
    } else {
      recommendations.push('Critical gaps in methodology implementation');
      recommendations.push('Immediate action required');
    }

    return recommendations;
  }

  /**
   * Get evaluation results
   */
  getEvaluationResults() {
    return this.evaluationResults;
  }

  /**
   * Reset the engine
   */
  reset() {
    this.evaluationResults = {};
    this.diagnosticQuestions = [];
  }
}

// Export for use in server.js
module.exports = DiagnosisEngine;
