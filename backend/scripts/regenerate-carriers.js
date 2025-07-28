const carrierService = require('../services/carrierService');

/**
 * Script to regenerate carrier Excel file with simplified structure
 * Only includes carrier_id, carrier_name, and status columns
 */
async function regenerateCarriers() {
  try {
    console.log('🔄 Regenerating carrier data with simplified structure...');
    
    const result = await carrierService.fetchAndSaveCarriers();
    
    if (result.success) {
      console.log(`✅ Successfully regenerated carrier data: ${result.message}`);
      console.log(`📊 Total carriers: ${result.count}`);
      console.log('📁 File saved to: backend/data/logistic_carrier.xlsx');
      console.log('📋 Columns: carrier_id, carrier_name, weight in gms, priority, status');
    } else {
      console.error(`❌ Failed to regenerate carrier data: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ Error regenerating carriers:', error.message);
  }
}

// Run the regeneration
regenerateCarriers(); 