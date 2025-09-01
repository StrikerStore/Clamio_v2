const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const service = require('../services/orderEnhancementService');

console.log('🖼️  Regenerating product images for all orders...\n');

async function regenerateProductImages() {
  try {
    
    // Load current orders
    const ordersPath = path.join(__dirname, '../data/orders.xlsx');
    if (!fs.existsSync(ordersPath)) {
      console.log('❌ Orders file not found');
      return;
    }
    
    const ordersWb = XLSX.readFile(ordersPath);
    const ordersWs = ordersWb.Sheets[ordersWb.SheetNames[0]];
    const orders = XLSX.utils.sheet_to_json(ordersWs, { defval: '' });
    
    console.log(`📦 Loaded ${orders.length} orders`);
    
    // Add product images using improved logic
    const enhancedOrders = await service.addProductImages(orders);
    
    // Count results
    const withImages = enhancedOrders.filter(o => o.product_image && o.product_image !== '/placeholder.svg').length;
    const withoutImages = enhancedOrders.filter(o => !o.product_image || o.product_image === '/placeholder.svg').length;
    
    console.log(`\n📊 Results:`);
    console.log(`  ✅ Orders with images: ${withImages}`);
    console.log(`  ⚠️  Orders without images: ${withoutImages}`);
    console.log(`  📈 Success rate: ${((withImages / orders.length) * 100).toFixed(1)}%`);
    
    // Show some examples
    console.log(`\n🔍 Sample orders with images:`);
    enhancedOrders.filter(o => o.product_image && o.product_image !== '/placeholder.svg').slice(0, 5).forEach((order, i) => {
      console.log(`  ${i+1}. ${order.product_name} -> ${order.product_image}`);
    });
    
    if (withoutImages > 0) {
      console.log(`\n⚠️  Sample orders without images:`);
      enhancedOrders.filter(o => !o.product_image || o.product_image === '/placeholder.svg').slice(0, 5).forEach((order, i) => {
        console.log(`  ${i+1}. ${order.product_name} -> ${order.product_image || 'MISSING'}`);
      });
    }
    
    // Save enhanced orders back to Excel
    const enhancedWs = XLSX.utils.json_to_sheet(enhancedOrders);
    const enhancedWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(enhancedWb, enhancedWs, 'Orders');
    
    // Create backup first
    const backupPath = path.join(__dirname, '../data/orders_backup_' + Date.now() + '.xlsx');
    fs.copyFileSync(ordersPath, backupPath);
    console.log(`\n💾 Backup created: ${path.basename(backupPath)}`);
    
    // Save enhanced orders
    XLSX.writeFile(enhancedWb, ordersPath);
    console.log(`\n✅ Enhanced orders saved to orders.xlsx`);
    console.log(`💡 You may need to restart your backend for changes to take effect`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the script
if (require.main === module) {
  regenerateProductImages();
}

module.exports = { regenerateProductImages };
