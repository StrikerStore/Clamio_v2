const shipwayCarrierService = require('./services/shipwayCarrierService');

async function testCarrierExtraction() {
  try {
    console.log('🚀 Testing Carrier Data Extraction...\n');
    
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
      console.log('\n📊 Sample carriers:');
      carriers.slice(0, 5).forEach((carrier, index) => {
        console.log(`  ${index + 1}. ID: ${carrier.carrier_id}, Name: ${carrier.carrier_name}, Status: ${carrier.status}, Weight: ${carrier.weight_in_kg || 'N/A'}, Priority: ${carrier.priority}`);
      });
      
      console.log('\n📋 Excel columns found:');
      if (carriers.length > 0) {
        console.log('  -', Object.keys(carriers[0]).join(', '));
      }
      
      // Show weight distribution
      const weights = carriers.map(c => c.weight_in_kg).filter(w => w);
      const uniqueWeights = [...new Set(weights)];
      console.log('\n⚖️  Weight distribution:');
      console.log('  - Unique weights found:', uniqueWeights.join(', '));
      console.log('  - Total carriers with weight:', weights.length);
      console.log('  - Total carriers without weight:', carriers.length - weights.length);
      
      // Show priority range
      const priorities = carriers.map(c => c.priority);
      console.log('\n🏆 Priority distribution:');
      console.log('  - Priority range:', Math.min(...priorities), 'to', Math.max(...priorities));
      console.log('  - Total carriers:', priorities.length);
    }
    
    console.log('\n🎉 Carrier extraction test completed!');
    console.log('✅ Expected columns: carrier_id, carrier_name, status, weight_in_kg, priority');
    console.log('✅ All carriers should have status: "Active"');
    console.log('✅ Weight extracted from carrier names in parentheses');
    console.log('✅ Priority assigned sequentially (1, 2, 3, 4...)');
    
  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    console.error('  - Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testCarrierExtraction(); 