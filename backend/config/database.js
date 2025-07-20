const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

/**
 * Excel Database Configuration and Utilities
 * Handles all database operations using Excel files
 */
class ExcelDatabase {
  constructor() {
    this.dbPath = process.env.DB_FILE_PATH || './data/users.xlsx';
    this.ensureDataDirectory();
    this.initializeDatabase();
  }

  /**
   * Ensure the data directory exists
   */
  ensureDataDirectory() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Initialize the database with default structure if it doesn't exist
   */
  initializeDatabase() {
    if (!fs.existsSync(this.dbPath)) {
      const defaultData = {
        users: [
          {
            id: 'superadmin_1',
            name: 'Super Admin',
            email: 'superadmin@example.com',
            phone: '+1234567890',
            password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK8i', // password123
            role: 'superadmin',
            status: 'active',
            createdAt: new Date().toISOString(),
            lastLogin: null,
            warehouseId: null,
            contactNumber: null
          }
        ]
      };

      this.saveData(defaultData);
      console.log('Database initialized with default superadmin user');
    }
  }

  /**
   * Load data from Excel file
   * @returns {Object} Parsed data from Excel file
   */
  loadData() {
    try {
      if (!fs.existsSync(this.dbPath)) {
        return { users: [] };
      }

      const workbook = XLSX.readFile(this.dbPath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const data = XLSX.utils.sheet_to_json(worksheet);
      return { users: data };
    } catch (error) {
      console.error('Error loading data from Excel:', error);
      return { users: [] };
    }
  }

  /**
   * Save data to Excel file
   * @param {Object} data - Data to save
   */
  saveData(data) {
    try {
      const worksheet = XLSX.utils.json_to_sheet(data.users || []);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
      XLSX.writeFile(workbook, this.dbPath);
    } catch (error) {
      console.error('Error saving data to Excel:', error);
      throw new Error('Failed to save data to database');
    }
  }

  /**
   * Get all users
   * @returns {Array} Array of all users
   */
  getAllUsers() {
    const data = this.loadData();
    return data.users || [];
  }

  /**
   * Get user by ID
   * @param {string} id - User ID
   * @returns {Object|null} User object or null if not found
   */
  getUserById(id) {
    const users = this.getAllUsers();
    return users.find(user => user.id === id) || null;
  }

  /**
   * Get user by email
   * @param {string} email - User email
   * @returns {Object|null} User object or null if not found
   */
  getUserByEmail(email) {
    const users = this.getAllUsers();
    return users.find(user => user.email === email) || null;
  }

  /**
   * Get user by phone
   * @param {string} phone - User phone number
   * @returns {Object|null} User object or null if not found
   */
  getUserByPhone(phone) {
    const users = this.getAllUsers();
    return users.find(user => user.phone === phone) || null;
  }

  /**
   * Create new user
   * @param {Object} userData - User data
   * @returns {Object} Created user object
   */
  createUser(userData) {
    const users = this.getAllUsers();
    
    // Check if email already exists
    if (users.some(user => user.email === userData.email)) {
      throw new Error('User with this email already exists');
    }

    // Check if phone already exists (if provided)
    if (userData.phone && users.some(user => user.phone === userData.phone)) {
      throw new Error('User with this phone number already exists');
    }

    const newUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...userData,
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    users.push(newUser);
    this.saveData({ users });
    
    // Return user without password
    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  /**
   * Update user
   * @param {string} id - User ID
   * @param {Object} updateData - Data to update
   * @returns {Object|null} Updated user object or null if not found
   */
  updateUser(id, updateData) {
    const users = this.getAllUsers();
    const userIndex = users.findIndex(user => user.id === id);
    
    if (userIndex === -1) {
      return null;
    }

    // Check if email already exists (excluding current user)
    if (updateData.email && users.some(user => user.email === updateData.email && user.id !== id)) {
      throw new Error('User with this email already exists');
    }

    // Check if phone already exists (excluding current user)
    if (updateData.phone && users.some(user => user.phone === updateData.phone && user.id !== id)) {
      throw new Error('User with this phone number already exists');
    }

    users[userIndex] = {
      ...users[userIndex],
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    this.saveData({ users });
    
    // Return user without password
    const { password, ...userWithoutPassword } = users[userIndex];
    return userWithoutPassword;
  }

  /**
   * Delete user
   * @param {string} id - User ID
   * @returns {boolean} True if deleted, false if not found
   */
  deleteUser(id) {
    const users = this.getAllUsers();
    const filteredUsers = users.filter(user => user.id !== id);
    
    if (filteredUsers.length === users.length) {
      return false;
    }

    this.saveData({ users: filteredUsers });
    return true;
  }

  /**
   * Update user's last login
   * @param {string} id - User ID
   */
  updateLastLogin(id) {
    const users = this.getAllUsers();
    const userIndex = users.findIndex(user => user.id === id);
    
    if (userIndex !== -1) {
      users[userIndex].lastLogin = new Date().toISOString();
      this.saveData({ users });
    }
  }

  /**
   * Get users by role
   * @param {string} role - User role (admin, vendor, superadmin)
   * @returns {Array} Array of users with specified role
   */
  getUsersByRole(role) {
    const users = this.getAllUsers();
    return users.filter(user => user.role === role);
  }

  /**
   * Get users by status
   * @param {string} status - User status (active, inactive)
   * @returns {Array} Array of users with specified status
   */
  getUsersByStatus(status) {
    const users = this.getAllUsers();
    return users.filter(user => user.status === status);
  }
}

module.exports = new ExcelDatabase(); 