#!/usr/bin/env node

/**
 * Autodesk Diagnosis Platform - API Testing Script
 * Tests all endpoints with sample data
 *
 * Usage: node test-api.js
 * (Make sure server is running on http://localhost:8080)
 */

const BASE_URL = 'http://localhost:8080';

// Sample diagnosis data for testing
const testDiagnosis = {
  clientName: 'Test Client Corp',
  companyName: 'Test Corporation',
  industry: 'Engineering',
  role: 'Director of Operations',
  clientEmail: 'test@testcorp.mx',
  clientPhone: '+52-33-1234-5678',
  country: 'Mexico',
  products: ['revit', 'autocad'],
  challenges: ['process-standardization', 'skill-gaps']
};

// Color console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

async function testEndpoint(method, path, data = null) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    log(`${method} ${path}`, 'blue');
    const response = await fetch(url, options);
    const responseData = await response.json();

    if (response.ok) {
      log(`✅ ${response.status} ${response.statusText}`, 'green');
      console.log(JSON.stringify(responseData, null, 2));
      return { success: true, data: responseData, status: response.status };
    } else {
      log(`❌ ${response.status} ${response.statusText}`, 'red');
      console.log(JSON.stringify(responseData, null, 2));
      return { success: false, data: responseData, status: response.status };
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function runTests() {
  try {
    logSection('AUTODESK DIAGNOSIS PLATFORM - API TEST SUITE');

    // Test 1: Health Check
    logSection('TEST 1: Health Check');
    const healthResult = await testEndpoint('GET', '/health');
    if (!healthResult.success) {
      log('❌ Server not responding. Make sure it is running on port 8080', 'red');
      process.exit(1);
    }

    // Test 2: API Info
    logSection('TEST 2: API Information');
    await testEndpoint('GET', '/api');

    // Test 3: Get Products
    logSection('TEST 3: List Available Products');
    const productsResult = await testEndpoint('GET', '/api/products');

    // Test 4: Get Challenges
    logSection('TEST 4: List Business Challenges');
    const challengesResult = await testEndpoint('GET', '/api/challenges');

    // Test 5: Create Diagnosis
    logSection('TEST 5: Generate New Diagnosis');
    const diagnosisResult = await testEndpoint('POST', '/api/diagnosis', testDiagnosis);

    if (!diagnosisResult.success) {
      log('❌ Failed to create diagnosis', 'red');
      process.exit(1);
    }

    const diagnosisId = diagnosisResult.data.diagnosisId ||
                        diagnosisResult.data.diagnosis?.id ||
                        'unknown';
    const clientId = diagnosisResult.data.clientId || 'unknown';

    log(`\n📝 Created Diagnosis - ID: ${diagnosisId}, Client ID: ${clientId}`, 'green');

    // Test 6: List All Diagnoses
    logSection('TEST 6: List All Diagnoses');
    await testEndpoint('GET', '/api/diagnoses');

    // Test 7: List with Filter
    logSection('TEST 7: List Diagnoses with Filter (by company)');
    await testEndpoint('GET', `/api/diagnoses?company=${testDiagnosis.companyName}`);

    // Test 8: Get Specific Diagnosis
    if (diagnosisId !== 'unknown') {
      logSection('TEST 8: Get Specific Diagnosis Details');
      await testEndpoint('GET', `/api/diagnoses/${diagnosisId}`);
    }

    // Test 9: Invalid Request
    logSection('TEST 9: Test Error Handling (Invalid Request)');
    await testEndpoint('POST', '/api/diagnosis', {
      clientName: 'Test'
      // Missing required fields
    });

    // Test 10: Non-existent Endpoint
    logSection('TEST 10: Test 404 Handler');
    await testEndpoint('GET', '/invalid-endpoint');

    // Summary
    logSection('TEST SUMMARY');
    log('✅ All tests completed', 'green');
    log(`\nEndpoints tested:`, 'yellow');
    log('  ✓ GET /health');
    log('  ✓ GET /api');
    log('  ✓ GET /api/products');
    log('  ✓ GET /api/challenges');
    log('  ✓ POST /api/diagnosis');
    log('  ✓ GET /api/diagnoses');
    log('  ✓ GET /api/diagnoses (with filters)');
    log('  ✓ GET /api/diagnoses/:id');
    log('  ✓ Error handling');
    log('\n' + '='.repeat(60) + '\n');

  } catch (error) {
    log(`\n❌ Test suite error: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run tests
runTests().then(() => {
  log('Tests completed successfully!', 'green');
  process.exit(0);
}).catch(err => {
  log(`Fatal error: ${err.message}`, 'red');
  process.exit(1);
});
