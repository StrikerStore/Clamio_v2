const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const ordersPath = path.join(__dirname, '../backend/data/orders.xlsx');

console.log('🔍 Checking current orders.xlsx structure...\n');

if (fs.existsSync(ordersPath)) {
  const wb = XLSX.readFile(ordersPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws);
  
  console.log('📊 Current orders.xlsx structure:');
  console.log('Total rows:', data.length);
  console.log('Columns:', Object.keys(data[0]));
  
  console.log('\n📋 Sample row (first order):');
  const sample = data[0];
  Object.keys(sample).forEach(key => {
    const value = sample[key];
    if (typeof value === 'string' && value.length > 50) {
      console.log(`${key}: ${value.substring(0, 50)}...`);
    } else {
      console.log(`${key}: ${value}`);
    }
  });
  
  // Check for customer_name and product_image columns specifically
  console.log('\n🔍 Column Analysis:');
  console.log('Has customer_name:', data[0].hasOwnProperty('customer_name'));
  console.log('Has product_image:', data[0].hasOwnProperty('product_image'));
  
  if (data[0].customer_name) {
    console.log('✅ customer_name sample:', data[0].customer_name);
  }
  
  if (data[0].product_image) {
    console.log('✅ product_image sample:', data[0].product_image.substring(0, 60) + '...');
  }
  
} else {
  console.log('❌ orders.xlsx not found');
} 