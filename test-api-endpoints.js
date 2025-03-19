import fetch from 'node-fetch';

// Base URL for the API
const API_BASE_URL = 'http://localhost:5000/api';

// Test endpoints
const endpoints = [
  { method: 'GET', url: '/competitions' },
  { method: 'GET', url: '/competitions/all' },
  { method: 'GET', url: '/competitions/active' },
  { method: 'GET', url: '/competitions/upcoming' },
  { method: 'GET', url: '/golfers' },
  { method: 'GET', url: '/leaderboard' },
  // Add authorization header for dashboard/stats
  { 
    method: 'GET', 
    url: '/dashboard/stats',
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN_HERE' // We'll need to update this
    }
  },
];

// Function to test an endpoint
async function testEndpoint(method, url, customHeaders = {}) {
  console.log(`Testing ${method} ${url}...`);
  
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...customHeaders
    };
    
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method,
      headers
    });
    
    const status = response.status;
    let data;
    
    try {
      data = await response.json();
    } catch (parseError) {
      data = { error: 'Failed to parse response as JSON' };
    }
    
    console.log(`Status: ${status}`);
    console.log('Response:', JSON.stringify(data, null, 2).substring(0, 200) + '...');
    console.log('-----------------------------------');
    
    return { success: response.ok, status, data };
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.log('-----------------------------------');
    return { success: false, error: error.message };
  }
}

// Run all tests
async function runTests() {
  console.log('Starting API endpoint tests...');
  console.log('===================================');
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint.method, endpoint.url, endpoint.headers);
    results.push({
      endpoint: `${endpoint.method} ${endpoint.url}`,
      ...result
    });
  }
  
  // Summary
  console.log('===================================');
  console.log('Test Summary:');
  console.log('===================================');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.length - successful;
  
  console.log(`Total endpoints tested: ${results.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\nFailed endpoints:');
    results
      .filter(r => !r.success)
      .forEach(r => console.log(`- ${r.endpoint}: ${r.error || `Status ${r.status}`}`));
  }
}

// Run the tests
runTests();