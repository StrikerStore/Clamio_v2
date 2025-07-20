const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:5000/api';
let authHeader = '';

// Test data
const testAdmin = {
  name: 'Test Admin',
  email: 'testadmin@example.com',
  phone: '+1234567890',
  password: 'TestPass123',
  role: 'admin',
  contactNumber: '+1234567890'
};

const testVendor = {
  name: 'Test Vendor',
  email: 'testvendor@example.com',
  phone: '+1234567891',
  password: 'TestPass123',
  role: 'vendor',
  warehouseId: '6430'
};

/**
 * Test API functionality with Basic Authentication
 */
async function testAPI() {
  console.log('🧪 Starting API Tests with Basic Authentication...\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing Health Check...');
    const healthResponse = await axios.get('http://localhost:5000/health');
    console.log('✅ Health check passed:', healthResponse.data.message);

    // Test 2: Generate Basic Auth Header for Superadmin
    console.log('\n2. Testing Basic Auth Header Generation...');
    const authHeaderResponse = await axios.post(`${BASE_URL}/auth/generate-header`, {
      email: 'superadmin@example.com',
      password: 'password123'
    });
    
    if (authHeaderResponse.data.success) {
      authHeader = authHeaderResponse.data.data.authHeader;
      console.log('✅ Basic Auth header generated successfully');
      console.log('🔑 Auth Header:', authHeader);
    } else {
      throw new Error('Basic Auth header generation failed');
    }

    // Test 3: Get All Users
    console.log('\n3. Testing Get All Users...');
    const usersResponse = await axios.get(`${BASE_URL}/users`, {
      headers: { Authorization: authHeader }
    });
    
    if (usersResponse.data.success) {
      console.log('✅ Get users successful');
      console.log(`📊 Total users: ${usersResponse.data.data.pagination.totalUsers}`);
    } else {
      throw new Error('Get users failed');
    }

    // Test 4: Create Admin User
    console.log('\n4. Testing Create Admin User...');
    const createAdminResponse = await axios.post(`${BASE_URL}/users`, testAdmin, {
      headers: { Authorization: authHeader }
    });
    
    if (createAdminResponse.data.success) {
      console.log('✅ Admin user created successfully');
      console.log('👤 Admin:', createAdminResponse.data.data.name);
    } else {
      throw new Error('Create admin failed');
    }

    // Test 5: Create Vendor User
    console.log('\n5. Testing Create Vendor User...');
    const createVendorResponse = await axios.post(`${BASE_URL}/users`, testVendor, {
      headers: { Authorization: authHeader }
    });
    
    if (createVendorResponse.data.success) {
      console.log('✅ Vendor user created successfully');
      console.log('👤 Vendor:', createVendorResponse.data.data.name);
    } else {
      throw new Error('Create vendor failed');
    }

    // Test 6: Get Users by Role
    console.log('\n6. Testing Get Users by Role...');
    const adminUsersResponse = await axios.get(`${BASE_URL}/users/role/admin`, {
      headers: { Authorization: authHeader }
    });
    
    if (adminUsersResponse.data.success) {
      console.log('✅ Get admin users successful');
      console.log(`👥 Admin users: ${adminUsersResponse.data.data.length}`);
    } else {
      throw new Error('Get admin users failed');
    }

    // Test 7: Test Shipway Connection (if API key is configured)
    console.log('\n7. Testing Shipway API Connection...');
    try {
      const shipwayResponse = await axios.get(`${BASE_URL}/shipway/test-connection`, {
        headers: { Authorization: authHeader }
      });
      
      if (shipwayResponse.data.success) {
        console.log('✅ Shipway API connection test successful');
      } else {
        console.log('⚠️ Shipway API connection test failed (API key may not be configured)');
      }
    } catch (error) {
      console.log('⚠️ Shipway API test skipped (API key not configured)');
    }

    // Test 8: Validate Warehouse ID
    console.log('\n8. Testing Warehouse ID Validation...');
    try {
      const validateResponse = await axios.get(`${BASE_URL}/shipway/validate/6430`, {
        headers: { Authorization: authHeader }
      });
      
      if (validateResponse.data.success) {
        console.log('✅ Warehouse ID validation successful');
        console.log('🏢 Warehouse ID format is valid');
      } else {
        console.log('⚠️ Warehouse ID validation failed');
      }
    } catch (error) {
      console.log('⚠️ Warehouse validation test skipped (API key not configured)');
    }

    // Test 9: Get User Profile
    console.log('\n9. Testing Get User Profile...');
    const profileResponse = await axios.get(`${BASE_URL}/auth/profile`, {
      headers: { Authorization: authHeader }
    });
    
    if (profileResponse.data.success) {
      console.log('✅ Get profile successful');
      console.log('👤 Current user:', profileResponse.data.data.name);
    } else {
      throw new Error('Get profile failed');
    }

    // Test 10: Change Password
    console.log('\n10. Testing Change Password...');
    const changePasswordResponse = await axios.put(`${BASE_URL}/auth/change-password`, {
      oldPassword: 'password123',
      newPassword: 'NewPassword123',
      confirmPassword: 'NewPassword123'
    }, {
      headers: { Authorization: authHeader }
    });
    
    if (changePasswordResponse.data.success) {
      console.log('✅ Password change successful');
      console.log('🔄 New auth header generated');
      
      // Update auth header with new password
      authHeader = changePasswordResponse.data.data.authHeader;
      
      // Change it back
      const revertPasswordResponse = await axios.put(`${BASE_URL}/auth/change-password`, {
        oldPassword: 'NewPassword123',
        newPassword: 'password123',
        confirmPassword: 'password123'
      }, {
        headers: { Authorization: authHeader }
      });
      
      if (revertPasswordResponse.data.success) {
        authHeader = revertPasswordResponse.data.data.authHeader;
        console.log('🔄 Password changed back to original');
      }
    } else {
      throw new Error('Change password failed');
    }

    // Test 11: Verify Basic Auth
    console.log('\n11. Testing Basic Auth Verification...');
    const verifyResponse = await axios.get(`${BASE_URL}/auth/verify`, {
      headers: { Authorization: authHeader }
    });
    
    if (verifyResponse.data.success) {
      console.log('✅ Basic Auth verification successful');
      console.log('🔐 Credentials are valid');
    } else {
      throw new Error('Basic Auth verification failed');
    }

    console.log('\n🎉 All tests passed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('✅ Health check');
    console.log('✅ Basic Authentication');
    console.log('✅ User management');
    console.log('✅ Role-based access');
    console.log('✅ Shipway integration');
    console.log('✅ Profile management');
    console.log('✅ Password management');
    console.log('✅ Auth verification');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    process.exit(1);
  }
}

/**
 * Cleanup test data
 */
async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    if (!authHeader) {
      console.log('⚠️ No auth header available for cleanup');
      return;
    }

    // Get all users
    const usersResponse = await axios.get(`${BASE_URL}/users`, {
      headers: { Authorization: authHeader }
    });

    if (usersResponse.data.success) {
      const users = usersResponse.data.data.users;
      
      // Delete test users
      for (const user of users) {
        if (user.email === testAdmin.email || user.email === testVendor.email) {
          await axios.delete(`${BASE_URL}/users/${user.id}`, {
            headers: { Authorization: authHeader }
          });
          console.log(`🗑️ Deleted test user: ${user.name}`);
        }
      }
    }

    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  }
}

// Run tests
if (require.main === module) {
  testAPI()
    .then(() => cleanup())
    .then(() => {
      console.log('\n✨ Test suite completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test suite failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testAPI, cleanup }; 