const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs'); // Added missing import for fs

console.log('🔍 Checking image data in orders and products...\n');

try {
  // Check orders data
  const ordersPath = path.join(__dirname, 'data/orders.xlsx');
  if (fs.existsSync(ordersPath)) {
    const orders = XLSX.readFile(ordersPath);
    const ordersData = XLSX.utils.sheet_to_json(orders.Sheets[orders.SheetNames[0]]);
    
    console.log('📦 ORDERS DATA:');
    console.log(`  Total orders: ${ordersData.length}`);
    console.log(`  Orders with product_image: ${ordersData.filter(o => o.product_image && o.product_image !== '/placeholder.svg').length}`);
    console.log(`  Orders without product_image: ${ordersData.filter(o => !o.product_image || o.product_image === '/placeholder.svg').length}`);
    
    // Show sample orders
    console.log('\n  Sample orders:');
    ordersData.slice(0, 5).forEach((order, i) => {
      console.log(`    ${i+1}. ${order.product_name || order.product} -> Image: ${order.product_image || 'MISSING'}`);
    });
  } else {
    console.log('❌ Orders file not found');
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Check products data
  const productsPath = path.join(__dirname, 'data/products.xlsx');
  if (fs.existsSync(productsPath)) {
    const products = XLSX.readFile(productsPath);
    const productsData = XLSX.utils.sheet_to_json(products.Sheets[products.SheetNames[0]]);
    
    console.log('🖼️  PRODUCTS DATA:');
    console.log(`  Total products: ${productsData.length}`);
    console.log(`  Products with images: ${productsData.filter(p => p.image && p.image !== '/placeholder.svg').length}`);
    console.log(`  Products without images: ${productsData.filter(p => !p.image || p.image === '/placeholder.svg').length}`);
    
    // Show sample products
    console.log('\n  Sample products with images:');
    productsData.filter(p => p.image && p.image !== '/placeholder.svg').slice(0, 5).forEach((product, i) => {
      console.log(`    ${i+1}. ${product.name} -> ${product.image}`);
    });
    
    console.log('\n  Sample products without images:');
    productsData.filter(p => !p.image || p.image === '/placeholder.svg').slice(0, 5).forEach((product, i) => {
      console.log(`    ${i+1}. ${product.name} -> ${product.image || 'MISSING'}`);
    });
  } else {
    console.log('❌ Products file not found');
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
