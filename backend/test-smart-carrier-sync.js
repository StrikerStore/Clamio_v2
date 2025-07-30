const ShipwayCarrierService = require('./services/shipwayCarrierService');

async function testSmartCarrierSync() {
  try {
    console.log('🧪 Testing Smart Carrier Sync Logic...\n');
    
    const shipwayCarrierService = new ShipwayCarrierService();
    
    // Test the smart sync
    const result = await shipwayCarrierService.syncCarriersToExcel();
    
    console.log('\n✅ Test completed successfully!');
    console.log('📊 Result:', result);
    
    // Read back the carriers to verify
    const carriers = shipwayCarrierService.readCarriersFromExcel();
    console.log('\n📋 Final carriers in Excel:');
    carriers.forEach((carrier, index) => {
      console.log(`  ${index + 1}. ${carrier.carrier_id} - ${carrier.carrier_name} (Priority: ${carrier.priority}, Status: ${carrier.status})`);
    });
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testSmartCarrierSync(); 