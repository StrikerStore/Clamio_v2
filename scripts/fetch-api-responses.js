const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';
const OUTPUT_DIR = path.join(__dirname, '../backend/data');

// Authentication tokens (you'll need to replace with valid ones)
// To get these:
// 1. Login to your app and check localStorage in browser dev tools
// 2. Copy 'authHeader' value for AUTH_HEADER
// 3. Copy 'vendorToken' value for VENDOR_TOKEN
const AUTH_HEADER = process.env.AUTH_HEADER || 'Basic <your-auth-token-here>'; // Replace with actual token
const VENDOR_TOKEN = process.env.VENDOR_TOKEN || '<your-vendor-token-here>'; // Replace with actual vendor token

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// API calling helper for internal APIs
async function callAPI(endpoint, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE_URL}${endpoint}`;
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = httpModule.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsedData);
          } else {
            console.error(`Error calling ${endpoint}: HTTP ${res.statusCode}`);
            resolve({ error: `HTTP ${res.statusCode}`, response: parsedData });
          }
        } catch (error) {
          console.error(`Error parsing JSON for ${endpoint}:`, error.message);
          resolve({ error: 'JSON parse error', raw: data });
        }
      });
    });

    req.on('error', (error) => {
      console.error(`Error calling ${endpoint}:`, error.message);
      resolve({ error: error.message });
    });

    req.end();
  });
}

// API calling helper for external APIs (like Shipway)
async function callAPIExternal(fullUrl, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(fullUrl);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Node.js Script',
        ...headers
      }
    };

    const req = httpModule.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsedData);
          } else {
            console.error(`Error calling ${fullUrl}: HTTP ${res.statusCode}`);
            resolve({ error: `HTTP ${res.statusCode}`, response: parsedData });
          }
        } catch (error) {
          console.error(`Error parsing JSON for ${fullUrl}:`, error.message);
          resolve({ error: 'JSON parse error', raw: data });
        }
      });
    });

    req.on('error', (error) => {
      console.error(`Error calling ${fullUrl}:`, error.message);
      resolve({ error: error.message });
    });

    req.end();
  });
}

// Save JSON response to file
function saveJSON(filename, data) {
  const filePath = path.join(OUTPUT_DIR, `${filename}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`✅ Saved: ${filename}.json`);
}

// Main function to fetch all API responses
async function fetchAllAPIResponses() {
  console.log('🚀 Starting API response collection...\n');

  // 1. Orders endpoints
  console.log('📦 Fetching Orders data...');
  const ordersResponse = await callAPI('/orders', { 'Authorization': AUTH_HEADER });
  saveJSON('orders-response', ordersResponse);

  const groupedOrdersResponse = await callAPI('/orders/grouped', { 'Authorization': VENDOR_TOKEN });
  saveJSON('grouped-orders-response', groupedOrdersResponse);

  const lastUpdatedResponse = await callAPI('/orders/last-updated', { 'Authorization': AUTH_HEADER });
  saveJSON('orders-last-updated-response', lastUpdatedResponse);

  // Shipway API - Direct call to get detailed order information
  console.log('🚢 Fetching Shipway Orders data...');
  try {
    const shipwayResponse = await callAPIExternal('https://app.shipway.com/api/getorders?status=O');
    saveJSON('shipway-orders-response', shipwayResponse);
  } catch (error) {
    console.error('Error fetching Shipway orders:', error.message);
    saveJSON('shipway-orders-response', { error: error.message });
  }

  // 2. Settlement endpoints
  console.log('\n💰 Fetching Settlement data...');
  const paymentsResponse = await callAPI('/settlements/vendor/payments', { 'Authorization': AUTH_HEADER });
  saveJSON('vendor-payments-response', paymentsResponse);

  const settlementsResponse = await callAPI('/settlements/vendor/history', { 'Authorization': AUTH_HEADER });
  saveJSON('vendor-settlements-response', settlementsResponse);

  const transactionsResponse = await callAPI('/settlements/vendor/transactions', { 'Authorization': AUTH_HEADER });
  saveJSON('vendor-transactions-response', transactionsResponse);

  // 3. User/Vendor endpoints
  console.log('\n👤 Fetching User data...');
  const addressResponse = await callAPI('/users/vendor/address', { 'Authorization': AUTH_HEADER });
  saveJSON('vendor-address-response', addressResponse);

  const profileResponse = await callAPI('/auth/profile', { 'Authorization': AUTH_HEADER });
  saveJSON('user-profile-response', profileResponse);

  // 4. Admin endpoints (if available)
  console.log('\n🔧 Fetching Admin data...');
  const usersResponse = await callAPI('/users?page=1&limit=10', { 'Authorization': AUTH_HEADER });
  saveJSON('users-list-response', usersResponse);

  const settlementsAdminResponse = await callAPI('/settlements/admin/all?page=1&limit=10', { 'Authorization': AUTH_HEADER });
  saveJSON('admin-settlements-response', settlementsAdminResponse);

  console.log('\n🎉 API response collection completed!');
  console.log(`📁 All JSON files saved to: ${OUTPUT_DIR}`);
}

// Execute the script
fetchAllAPIResponses().catch(console.error); 