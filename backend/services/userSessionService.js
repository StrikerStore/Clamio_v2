const XLSX = require('xlsx');
const path = require('path');
const crypto = require('crypto');

// Simple UUID generation function
function generateUUID() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older Node.js versions
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const USERS_XLSX_PATH = path.join(__dirname, '../data/users.xlsx');

class UserSessionService {
  constructor() {
    this.workbook = null;
    this.worksheet = null;
    this.headers = [];
    this.loadWorkbook();
  }

  loadWorkbook() {
    try {
      this.workbook = XLSX.readFile(USERS_XLSX_PATH);
      this.worksheet = this.workbook.Sheets[this.workbook.SheetNames[0]];
      
      // Get headers from first row
      const range = XLSX.utils.decode_range(this.worksheet['!ref']);
      this.headers = [];
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        const cell = this.worksheet[cellAddress];
        this.headers.push(cell ? cell.v : '');
      }

      // Ensure token and active_session columns exist
      this.ensureColumns();
    } catch (error) {
      console.error('Error loading users.xlsx:', error);
      throw error;
    }
  }

  ensureColumns() {
    if (!this.headers.includes('token')) {
      this.headers.push('token');
    }
    if (!this.headers.includes('active_session')) {
      this.headers.push('active_session');
    }

    // Update headers in worksheet
    this.headers.forEach((header, index) => {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: index });
      this.worksheet[cellAddress] = { v: header, t: 's' };
    });

    this.saveWorkbook();
  }

  saveWorkbook() {
    try {
      XLSX.writeFile(this.workbook, USERS_XLSX_PATH);
    } catch (error) {
      console.error('Error saving users.xlsx:', error);
      throw error;
    }
  }

  getColumnIndex(columnName) {
    return this.headers.indexOf(columnName);
  }

  getAllUsers() {
    const range = XLSX.utils.decode_range(this.worksheet['!ref']);
    const users = [];

    for (let row = 1; row <= range.e.r; row++) {
      const user = {};
      for (let col = 0; col < this.headers.length; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = this.worksheet[cellAddress];
        user[this.headers[col]] = cell ? cell.v : '';
      }
      users.push(user);
    }

    return users;
  }

  updateUserRow(rowIndex, updates) {
    Object.keys(updates).forEach(columnName => {
      const colIndex = this.getColumnIndex(columnName);
      if (colIndex !== -1) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
        this.worksheet[cellAddress] = { v: updates[columnName], t: 's' };
      }
    });
    this.saveWorkbook();
  }

  ensureTokensAndSessions() {
    const users = this.getAllUsers();
    
    users.forEach((user, index) => {
      const rowIndex = index + 1; // +1 because first row is headers
      const updates = {};

      // Ensure token exists
      if (!user.token) {
        updates.token = generateUUID();
      }

      // Ensure active_session is set to FALSE
      if (user.active_session !== 'TRUE' && user.active_session !== 'FALSE') {
        updates.active_session = 'FALSE';
      }

      if (Object.keys(updates).length > 0) {
        this.updateUserRow(rowIndex, updates);
      }
    });
  }

  loginVendor(warehouseId) {
    const users = this.getAllUsers();
    let foundToken = null;

    users.forEach((user, index) => {
      const rowIndex = index + 1;
      if (user.warehouseId === warehouseId) {
        // Set this vendor's session to TRUE
        this.updateUserRow(rowIndex, { active_session: 'TRUE' });
        foundToken = user.token || generateUUID();
        if (!user.token) {
          this.updateUserRow(rowIndex, { token: foundToken });
        }
      }
      // Removed: Don't set other vendors' sessions to FALSE
      // This allows multiple vendors to be logged in simultaneously
    });

    return foundToken;
  }

  getActiveVendor() {
    const users = this.getAllUsers();
    const activeUser = users.find(user => user.active_session === 'TRUE');
    return activeUser ? activeUser.warehouseId : null;
  }

  getVendorByToken(token) {
    const users = this.getAllUsers();
    return users.find(user => user.token === token && user.active_session === 'TRUE');
  }

  logoutVendor(warehouseId) {
    const users = this.getAllUsers();
    
    users.forEach((user, index) => {
      const rowIndex = index + 1;
      if (user.warehouseId === warehouseId) {
        this.updateUserRow(rowIndex, { active_session: 'FALSE' });
      }
    });
  }

  // Get vendor by email for login
  getVendorByEmail(email) {
    const users = this.getAllUsers();
    return users.find(user => user.email === email);
  }

  // Get vendor by phone for login
  getVendorByPhone(phone) {
    const users = this.getAllUsers();
    return users.find(user => user.phone === phone || user.contactNumber === phone);
  }
}

module.exports = new UserSessionService(); 