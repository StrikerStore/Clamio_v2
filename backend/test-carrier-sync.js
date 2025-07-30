const shipwayCarrierService = require('./services/shipwayCarrierService');

async function testCarrierSync() {
  try {
    console.log('🚀 Testing Carrier Sync Functionality...\n');
    
    // Test the complete sync process
    console.log('📡 Step 1: Fetching carriers from Shipway API...');
    const result = await shipwayCarrierService.syncCarriersToExcel();
    
    console.log('\n✅ Carrier sync completed successfully!');
    console.log('  - Result:', result);
    
    // Test reading from Excel
    console.log('\n📖 Step 2: Reading carriers from Excel file...');
    const carriers = shipwayCarrierService.readCarriersFromExcel();
    
    console.log('✅ Excel read completed!');
    console.log('  - Total carriers:', carriers.length);
    
    if (carriers.length > 0) {
      console.log('  - Sample carrier:', carriers[0]);
    }
    
    console.log('\n🎉 All tests passed! Carrier sync is working correctly.');
    
  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    console.error('  - Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testCarrierSync(); 