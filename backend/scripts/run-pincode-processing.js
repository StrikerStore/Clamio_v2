const pincodeServiceabilityService = require('../services/pincodeServiceabilityService');

/**
 * Standalone script to run pincode processing
 */
async function runPincodeProcessing() {
  try {
    console.log('🚀 Starting Pincode Processing...\n');
    
    const result = await pincodeServiceabilityService.processOrdersAndAssignCarriers();
    
    console.log('\n📊 Final Results:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n🎉 Pincode processing completed successfully!');
      console.log(`📁 Check the output file: ${result.outputFile}`);
    } else {
      console.log('\n❌ Pincode processing failed!');
      console.log(`Error: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    console.error('❌ Error stack:', error.stack);
  }
}

// Run the script
runPincodeProcessing(); 