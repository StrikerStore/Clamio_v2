const pincodeServiceabilityService = require('../services/pincodeServiceabilityService');
const fs = require('fs');
const path = require('path');

/**
 * Test script for pincode processing with detailed logging
 */
async function testPincodeProcessing() {
  try {
    console.log('🧪 Testing Pincode Processing with Detailed Logging...\n');

    // Check if raw orders file exists
    const rawOrdersPath = path.join(__dirname, '../data/raw_shipway_orders.json');
    console.log(`📁 Checking raw orders file: ${rawOrdersPath}`);
    
    if (!fs.existsSync(rawOrdersPath)) {
      console.error(`❌ Raw orders file not found at: ${rawOrdersPath}`);
      console.log('💡 Please ensure you have fetched orders first using the Shipway service');
      return;
    }
    console.log(`✅ Raw orders file found`);

    // Check file size
    const stats = fs.statSync(rawOrdersPath);
    console.log(`📊 Raw orders file size: ${stats.size} bytes`);

    // Read and parse raw orders
    console.log('📖 Reading raw orders file...');
    const rawOrdersData = JSON.parse(fs.readFileSync(rawOrdersPath, 'utf8'));
    console.log(`📦 Found ${rawOrdersData.length || 0} orders`);

    if (rawOrdersData.length === 0) {
      console.log('⚠️  No orders found in raw orders file');
      return;
    }

    // Show sample order structure
    console.log('📋 Sample order structure:');
    console.log(JSON.stringify(rawOrdersData[0], null, 2));

    // Check if carrier Excel file exists
    const carrierExcelPath = path.join(__dirname, '../data/logistic_carrier.xlsx');
    console.log(`\n📁 Checking carrier Excel file: ${carrierExcelPath}`);
    
    if (!fs.existsSync(carrierExcelPath)) {
      console.error(`❌ Carrier Excel file not found at: ${carrierExcelPath}`);
      console.log('💡 Please ensure you have fetched carriers first');
      return;
    }
    console.log(`✅ Carrier Excel file found`);

    // Test carrier priorities
    console.log('\n🏆 Testing carrier priorities...');
    const priorityMap = pincodeServiceabilityService.getCarrierPriorities();
    console.log(`🏆 Loaded priorities for ${priorityMap.size} carriers`);
    
    if (priorityMap.size === 0) {
      console.log('⚠️  No carrier priorities found. Please set priority values in logistic_carrier.xlsx');
    } else {
      console.log('📋 Sample priorities:');
      let count = 0;
      priorityMap.forEach((priority, carrierId) => {
        if (count < 5) {
          console.log(`  Carrier ${carrierId}: Priority ${priority}`);
          count++;
        }
      });
    }

    // Test with a single order first
    console.log('\n🔄 Testing with first order...');
    const firstOrder = rawOrdersData[0];
    const pincode = firstOrder.s_zipcode;
    
    if (!pincode) {
      console.log('⚠️  First order has no s_zipcode, trying second order...');
      const secondOrder = rawOrdersData[1];
      const secondPincode = secondOrder.s_zipcode;
      
      if (!secondPincode) {
        console.log('❌ No orders with s_zipcode found');
        return;
      }
      
      console.log(`🔍 Testing with s_zipcode: ${secondPincode}`);
      const serviceableCarriers = await pincodeServiceabilityService.checkPincodeServiceability(secondPincode);
      console.log(`📋 Found ${serviceableCarriers.length} serviceable carriers for s_zipcode ${secondPincode}`);
      console.log('📋 Serviceable carriers:', serviceableCarriers);
    } else {
      console.log(`🔍 Testing with s_zipcode: ${pincode}`);
      const serviceableCarriers = await pincodeServiceabilityService.checkPincodeServiceability(pincode);
      console.log(`📋 Found ${serviceableCarriers.length} serviceable carriers for s_zipcode ${pincode}`);
      console.log('📋 Serviceable carriers:', serviceableCarriers);
    }

    // Now test the full processing
    console.log('\n🔄 Testing full order processing...');
    const result = await pincodeServiceabilityService.processOrdersAndAssignCarriers();
    
    console.log('\n📊 Processing Results:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n🎉 Pincode processing test completed successfully!');
    } else {
      console.log('\n❌ Pincode processing test failed!');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('❌ Error stack:', error.stack);
  }
}

// Run the test
testPincodeProcessing(); 