const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// File paths
const PRODUCTS_EXCEL_PATH = path.join(__dirname, '../backend/data/products.xlsx');
const ORDERS_EXCEL_PATH = path.join(__dirname, '../backend/data/orders.xlsx');

console.log('🔍 Examining products and orders data structure...\n');

// Check products.xlsx
console.log('📊 Products.xlsx Analysis:');
if (fs.existsSync(PRODUCTS_EXCEL_PATH)) {
  const productsWb = XLSX.readFile(PRODUCTS_EXCEL_PATH);
  const productsWs = productsWb.Sheets[productsWb.SheetNames[0]];
  const productsData = XLSX.utils.sheet_to_json(productsWs);
  
  console.log(`✅ Products count: ${productsData.length}`);
  console.log(`📋 Columns: ${Object.keys(productsData[0]).join(', ')}`);
  
  console.log('\n🔬 Sample products:');
  productsData.slice(0, 5).forEach((product, i) => {
    console.log(`${i+1}. Name: "${product.name}"`);
    console.log(`   Image: "${product.image}"`);
    console.log('');
  });
} else {
  console.log('❌ products.xlsx not found');
}

// Check orders.xlsx product names
console.log('\n📦 Orders.xlsx Product Names Analysis:');
if (fs.existsSync(ORDERS_EXCEL_PATH)) {
  const ordersWb = XLSX.readFile(ORDERS_EXCEL_PATH);
  const ordersWs = ordersWb.Sheets[ordersWb.SheetNames[0]];
  const ordersData = XLSX.utils.sheet_to_json(ordersWs);
  
  console.log(`✅ Orders count: ${ordersData.length}`);
  
  console.log('\n🔬 Sample order product names:');
  ordersData.slice(0, 5).forEach((order, i) => {
    console.log(`${i+1}. Product: "${order.product_name}"`);
  });
  
  // Analyze size patterns
  console.log('\n📐 Size pattern analysis:');
  const sizePatterns = new Set();
  ordersData.forEach(order => {
    const productName = order.product_name || '';
    const sizeMatch = productName.match(/ - (XS|S|M|L|XL|2XL|3XL|\d+-\d+)$/);
    if (sizeMatch) {
      sizePatterns.add(sizeMatch[1]);
    }
  });
  console.log('Found size patterns:', Array.from(sizePatterns).sort());
  
} else {
  console.log('❌ orders.xlsx not found');
}

console.log('\n✨ Analysis complete!'); 