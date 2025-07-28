const fs = require('fs');
const path = require('path');

/**
 * Check if all required files exist for pincode processing
 */
function checkRequiredFiles() {
  console.log('🔍 Checking Required Files for Pincode Processing...\n');

  const files = [
    {
      name: 'Raw Orders File',
      path: path.join(__dirname, '../data/raw_shipway_orders.json'),
      required: true
    },
    {
      name: 'Carrier Excel File',
      path: path.join(__dirname, '../data/logistic_carrier.xlsx'),
      required: true
    },
    {
      name: 'Logistics Priority File',
      path: path.join(__dirname, '../data/logistic_priority.xlsx'),
      required: false
    },
    {
      name: 'Data Directory',
      path: path.join(__dirname, '../data'),
      required: true,
      isDirectory: true
    }
  ];

  let allFilesExist = true;

  files.forEach(file => {
    const exists = fs.existsSync(file.path);
    const status = exists ? '✅' : '❌';
    
    if (file.isDirectory) {
      console.log(`${status} ${file.name}: ${file.path}`);
    } else {
      if (exists) {
        const stats = fs.statSync(file.path);
        console.log(`${status} ${file.name}: ${file.path} (${stats.size} bytes)`);
      } else {
        console.log(`${status} ${file.name}: ${file.path} (NOT FOUND)`);
      }
    }

    if (file.required && !exists) {
      allFilesExist = false;
    }
  });

  console.log('\n📋 Summary:');
  if (allFilesExist) {
    console.log('✅ All required files exist!');
    
    // Check if raw orders file has data
    try {
      const rawOrdersPath = path.join(__dirname, '../data/raw_shipway_orders.json');
      const rawOrdersData = JSON.parse(fs.readFileSync(rawOrdersPath, 'utf8'));
      console.log(`📦 Raw orders file contains ${rawOrdersData.length} orders`);
      
      if (rawOrdersData.length > 0) {
        console.log('📋 Sample order keys:', Object.keys(rawOrdersData[0]));
        if (rawOrdersData[0].s_zipcode) {
          console.log(`✅ s_zipcode field found: ${rawOrdersData[0].s_zipcode}`);
        } else {
          console.log('❌ s_zipcode field not found in first order');
        }
      }
    } catch (error) {
      console.log('❌ Error reading raw orders file:', error.message);
    }
  } else {
    console.log('❌ Some required files are missing!');
    console.log('💡 Please ensure you have:');
    console.log('   - Fetched orders using Shipway service');
    console.log('   - Fetched carriers using Carrier service');
  }

  return allFilesExist;
}

// Run the check
checkRequiredFiles(); 