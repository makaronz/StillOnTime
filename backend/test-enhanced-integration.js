#!/usr/bin/env node

/**
 * Simple integration test for enhanced services
 */
const http = require('http');

async function testEnhancedServices() {
  console.log('🧪 Testing Enhanced Services Integration');
  console.log('=' .repeat(50));
  
  // Test 1: Enhanced services health check
  try {
    await makeRequest('/api/enhanced/health', 'GET');
    console.log('✅ Enhanced services health endpoint accessible');
  } catch (error) {
    console.log('❌ Enhanced services health endpoint failed:', error.message);
  }

  // Test 2: Enhanced services config
  try {
    await makeRequest('/api/enhanced/config', 'GET');
    console.log('✅ Enhanced services config endpoint accessible');
  } catch (error) {
    console.log('❌ Enhanced services config endpoint failed:', error.message);
  }

  // Test 3: API routes list
  try {
    await makeRequest('/api/health', 'GET');
    console.log('✅ Main API health check accessible');
  } catch (error) {
    console.log('❌ Main API health check failed:', error.message);
  }

  console.log('\n🎯 Enhanced Services Integration Test Complete');
}

function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Run the test if server is available
testEnhancedServices().catch(error => {
  console.log('❌ Test failed:', error.message);
  console.log('💡 Make sure the development server is running with: npm run dev');
});