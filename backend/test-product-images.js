const XLSX = require('xlsx');
const path = require('path');

function testProductImages() {
  try {
    console.log('🧪 Testing Product Images in Orders Data...\n');
    
    const ordersExcelPath = path.join(__dirname, 'data/orders.xlsx');
    const productsExcelPath = path.join(__dirname, 'data/products.xlsx');
    
    // Check if files exist
    if (!require('fs').existsSync(ordersExcelPath)) {
      console.log('❌ orders.xlsx not found');
      return;
    }
    
    if (!require('fs').existsSync(productsExcelPath)) {
      console.log('❌ products.xlsx not found');
      return;
    }
    
    // Read orders data
    const ordersWorkbook = XLSX.readFile(ordersExcelPath);
    const ordersWorksheet = ordersWorkbook.Sheets[ordersWorkbook.SheetNames[0]];
    const orders = XLSX.utils.sheet_to_json(ordersWorksheet);
    
    // Read products data
    const productsWorkbook = XLSX.readFile(productsExcelPath);
    const productsWorksheet = productsWorkbook.Sheets[productsWorkbook.SheetNames[0]];
    const products = XLSX.utils.sheet_to_json(productsWorksheet);
    
    console.log(`📊 Orders found: ${orders.length}`);
    console.log(`📊 Products found: ${products.length}`);
    
    // Check for product_image column in orders
    const sampleOrder = orders[0];
    if (sampleOrder) {
      console.log('\n📋 Sample Order Structure:');
      console.log('  - product_name:', sampleOrder.product_name);
      console.log('  - product_image:', sampleOrder.product_image);
      console.log('  - customer_name:', sampleOrder.customer_name);
    }
    
    // Check how many orders have product images
    const ordersWithImages = orders.filter(order => order.product_image && order.product_image.trim() !== '');
    const ordersWithoutImages = orders.filter(order => !order.product_image || order.product_image.trim() === '');
    
    console.log('\n📊 Product Image Statistics:');
    console.log(`  - Orders with images: ${ordersWithImages.length}`);
    console.log(`  - Orders without images: ${ordersWithoutImages.length}`);
    console.log(`  - Image coverage: ${((ordersWithImages.length / orders.length) * 100).toFixed(1)}%`);
    
    // Show sample orders with images
    if (ordersWithImages.length > 0) {
      console.log('\n✅ Sample Orders with Images:');
      ordersWithImages.slice(0, 3).forEach((order, index) => {
        console.log(`  ${index + 1}. ${order.product_name}`);
        console.log(`     Image: ${order.product_image}`);
      });
    }
    
    // Show sample orders without images
    if (ordersWithoutImages.length > 0) {
      console.log('\n❌ Sample Orders without Images:');
      ordersWithoutImages.slice(0, 3).forEach((order, index) => {
        console.log(`  ${index + 1}. ${order.product_name}`);
        console.log(`     Product Code: ${order.product_code}`);
      });
    }
    
    console.log('\n✅ Product Images Test Completed!');
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testProductImages(); 