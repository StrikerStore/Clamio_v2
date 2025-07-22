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

  // Settlement Management Methods

  /**
   * Get all settlement requests
   * @returns {Array} Array of settlement requests
   */
  getAllSettlements() {
    const data = this.loadSettlementData();
    return data.settlements || [];
  }

  /**
   * Load settlement data from Excel file
   * @returns {Object} Parsed settlement data from Excel file
   */
  loadSettlementData() {
    try {
      const settlementPath = this.dbPath.replace('users.xlsx', 'settlements.xlsx');
      if (!fs.existsSync(settlementPath)) {
        return { settlements: [] };
      }

      const workbook = XLSX.readFile(settlementPath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const data = XLSX.utils.sheet_to_json(worksheet);
      return { settlements: data };
    } catch (error) {
      console.error('Error loading settlement data from Excel:', error);
      return { settlements: [] };
    }
  }

  /**
   * Save settlement data to Excel file
   * @param {Object} data - Settlement data to save
   */
  saveSettlementData(data) {
    try {
      const settlementPath = this.dbPath.replace('users.xlsx', 'settlements.xlsx');
      const worksheet = XLSX.utils.json_to_sheet(data.settlements || []);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Settlements');
      XLSX.writeFile(workbook, settlementPath);
    } catch (error) {
      console.error('Error saving settlement data to Excel:', error);
      throw new Error('Failed to save settlement data to database');
    }
  }

  /**
   * Create new settlement request
   * @param {Object} settlementData - Settlement request data
   * @returns {Object} Created settlement object
   */
  createSettlement(settlementData) {
    const settlements = this.getAllSettlements();
    
    const newSettlement = {
      id: `settlement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...settlementData,
      status: 'pending',
      paymentStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    settlements.push(newSettlement);
    this.saveSettlementData({ settlements });
    
    return newSettlement;
  }

  /**
   * Update settlement request
   * @param {string} id - Settlement ID
   * @param {Object} updateData - Data to update
   * @returns {Object|null} Updated settlement object or null if not found
   */
  updateSettlement(id, updateData) {
    const settlements = this.getAllSettlements();
    const settlementIndex = settlements.findIndex(settlement => settlement.id === id);
    
    if (settlementIndex === -1) {
      return null;
    }

    settlements[settlementIndex] = {
      ...settlements[settlementIndex],
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    this.saveSettlementData({ settlements });
    return settlements[settlementIndex];
  }

  /**
   * Get settlement by ID
   * @param {string} id - Settlement ID
   * @returns {Object|null} Settlement object or null if not found
   */
  getSettlementById(id) {
    const settlements = this.getAllSettlements();
    return settlements.find(settlement => settlement.id === id) || null;
  }

  /**
   * Get settlements by vendor ID
   * @param {string} vendorId - Vendor ID
   * @returns {Array} Array of settlements for the vendor
   */
  getSettlementsByVendor(vendorId) {
    const settlements = this.getAllSettlements();
    return settlements.filter(settlement => settlement.vendorId === vendorId);
  }

  /**
   * Get settlements by status
   * @param {string} status - Settlement status (pending, approved, rejected)
   * @returns {Array} Array of settlements with specified status
   */
  getSettlementsByStatus(status) {
    const settlements = this.getAllSettlements();
    return settlements.filter(settlement => settlement.status === status);
  }

  // Transaction History Methods

  /**
   * Get all transactions
   * @returns {Array} Array of transaction records
   */
  getAllTransactions() {
    const data = this.loadTransactionData();
    return data.transactions || [];
  }

  /**
   * Load transaction data from Excel file
   * @returns {Object} Parsed transaction data from Excel file
   */
  loadTransactionData() {
    try {
      const transactionPath = this.dbPath.replace('users.xlsx', 'transactions.xlsx');
      if (!fs.existsSync(transactionPath)) {
        return { transactions: [] };
      }

      const workbook = XLSX.readFile(transactionPath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const data = XLSX.utils.sheet_to_json(worksheet);
      return { transactions: data };
    } catch (error) {
      console.error('Error loading transaction data from Excel:', error);
      return { transactions: [] };
    }
  }

  /**
   * Save transaction data to Excel file
   * @param {Object} data - Transaction data to save
   */
  saveTransactionData(data) {
    try {
      const transactionPath = this.dbPath.replace('users.xlsx', 'transactions.xlsx');
      const worksheet = XLSX.utils.json_to_sheet(data.transactions || []);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
      XLSX.writeFile(workbook, transactionPath);
    } catch (error) {
      console.error('Error saving transaction data to Excel:', error);
      throw new Error('Failed to save transaction data to database');
    }
  }

  /**
   * Create new transaction record
   * @param {Object} transactionData - Transaction data
   * @returns {Object} Created transaction object
   */
  createTransaction(transactionData) {
    const transactions = this.getAllTransactions();
    
    const newTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...transactionData,
      createdAt: new Date().toISOString()
    };

    transactions.push(newTransaction);
    this.saveTransactionData({ transactions });
    
    return newTransaction;
  }

  /**
   * Get transactions by vendor ID
   * @param {string} vendorId - Vendor ID
   * @returns {Array} Array of transactions for the vendor
   */
  getTransactionsByVendor(vendorId) {
    const transactions = this.getAllTransactions();
    return transactions.filter(transaction => transaction.vendorId === vendorId);
  }

  /**
   * Get transaction by ID
   * @param {string} id - Transaction ID
   * @returns {Object|null} Transaction object or null if not found
   */
  getTransactionById(id) {
    const transactions = this.getAllTransactions();
    return transactions.find(transaction => transaction.id === id) || null;
  }
}

module.exports = new ExcelDatabase(); 