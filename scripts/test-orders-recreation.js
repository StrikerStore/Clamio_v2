const fs = require('fs');
const path = require('path');
const shipwayService = require('../backend/services/shipwayService');

const ordersPath = path.join(__dirname, '../backend/data/orders.xlsx');
const backupPath = path.join(__dirname, '../backend/data/orders_backup.xlsx');

async function testOrdersRecreation() {
  console.log('🧪 Testing orders.xlsx recreation and auto-enhancement...\n');

  try {
    // Step 1: Create backup if orders.xlsx exists
    if (fs.existsSync(ordersPath)) {
      console.log('💾 Creating backup of current orders.xlsx...');
      if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(ordersPath, backupPath);
        console.log('✅ Backup created');
      } else {
        console.log('ℹ️  Backup already exists');
      }
    }

    // Step 2: Delete orders.xlsx to simulate the issue
    if (fs.existsSync(ordersPath)) {
      console.log('🗑️  Deleting orders.xlsx to simulate recreation scenario...');
      fs.unlinkSync(ordersPath);
      console.log('✅ orders.xlsx deleted');
    }

    // Step 3: Call shipway service to recreate orders.xlsx
    console.log('🔄 Calling shipwayService.syncOrdersToExcel() to recreate file...');
    const result = await shipwayService.syncOrdersToExcel();
    
    if (result.success) {
      console.log('✅ Orders sync completed successfully');
      console.log(`📊 Orders count: ${result.count}`);
    } else {
      console.log('❌ Orders sync failed');
      return;
    }

    // Step 4: Verify the recreated file has customer_name and product_image columns
    console.log('\n🔍 Verifying recreated orders.xlsx structure...');
    
    if (fs.existsSync(ordersPath)) {
      const XLSX = require('xlsx');
      const wb = XLSX.readFile(ordersPath);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      
      console.log(`📋 Total orders: ${data.length}`);
      console.log(`📊 Columns: ${Object.keys(data[0]).length}`);
      
      const hasCustomerName = data[0].hasOwnProperty('customer_name');
      const hasProductImage = data[0].hasOwnProperty('product_image');
      
      console.log(`👥 Has customer_name: ${hasCustomerName ? '✅' : '❌'}`);
      console.log(`🖼️  Has product_image: ${hasProductImage ? '✅' : '❌'}`);
      
      if (hasCustomerName && hasProductImage) {
        console.log('\n🎉 SUCCESS: Auto-enhancement working correctly!');
        console.log('Sample data:');
        console.log(`- Order ID: ${data[0].order_id}`);
        console.log(`- Customer: ${data[0].customer_name}`);
        console.log(`- Product: ${data[0].product_name}`);
        console.log(`- Image: ${data[0].product_image ? data[0].product_image.substring(0, 50) + '...' : 'None'}`);
      } else {
        console.log('\n❌ FAILED: Auto-enhancement not working');
      }
    } else {
      console.log('❌ orders.xlsx was not created');
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

// Run the test
testOrdersRecreation(); 