const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const carrierExcelPath = path.join(__dirname, 'data/carrier.xlsx');

console.log('🔍 Testing Carrier Excel File...\n');

// Check if file exists
if (fs.existsSync(carrierExcelPath)) {
  console.log('✅ carrier.xlsx file exists');
  console.log('  - Path:', carrierExcelPath);
  
  // Get file stats
  const stats = fs.statSync(carrierExcelPath);
  console.log('  - Size:', stats.size, 'bytes');
  console.log('  - Last modified:', stats.mtime);
  
  // Read the file
  try {
    const workbook = XLSX.readFile(carrierExcelPath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const carriers = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    
    console.log('\n📊 Carrier data:');
    console.log('  - Total carriers:', carriers.length);
    console.log('  - Columns:', carriers.length > 0 ? Object.keys(carriers[0]) : 'No data');
    
    if (carriers.length > 0) {
      console.log('\n📋 Sample carriers:');
      carriers.slice(0, 3).forEach((carrier, index) => {
        console.log(`  ${index + 1}. ID: ${carrier.carrier_id}, Name: ${carrier.carrier_name}, Status: ${carrier.status}, Priority: ${carrier.priority}, Weight: ${carrier.weight_in_kg}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error reading carrier.xlsx:', error.message);
  }
  
} else {
  console.log('❌ carrier.xlsx file does not exist');
  console.log('  - Expected path:', carrierExcelPath);
  console.log('\n💡 You may need to run the carrier sync first:');
  console.log('  node manual-carrier-sync.js');
} 