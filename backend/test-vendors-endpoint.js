const https = require('https');
const http = require('http');

// Test the vendors API endpoint
const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/orders/admin/vendors',
  method: 'GET',
  headers: {
    'Authorization': 'Basic YWRtaW5AZXhhbXBsZS5jb206cGFzc3dvcmQxMjM=', // admin@example.com:password123
    'Content-Type': 'application/json'
  }
};

console.log('Testing vendors API endpoint...');
console.log('URL: http://localhost:5000/api/orders/admin/vendors');

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response Body:');
    try {
      const jsonData = JSON.parse(data);
      console.log(JSON.stringify(jsonData, null, 2));
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error.message);
});

req.end(); 