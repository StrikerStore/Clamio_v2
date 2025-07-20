const database = require('../config/database');
const { hashPassword } = require('../middleware/auth');
const shipwayService = require('../services/shipwayService');

/**
 * User Management Controller
 * Handles user CRUD operations for superadmin
 */
class UserController {
  /**
   * Create a new user (admin or vendor)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createUser(req, res) {
    try {
      const {
        name,
        email,
        phone,
        password,
        role,
        status = 'active',
        warehouseId,
        contactNumber
      } = req.body;

      // Validate role-specific requirements
      if (role === 'vendor' && !warehouseId) {
        return res.status(400).json({
          success: false,
          message: 'Warehouse ID is required for vendors'
        });
      }

      if (role === 'admin' && !contactNumber) {
        return res.status(400).json({
          success: false,
          message: 'Contact number is required for admins'
        });
      }

      // For vendors, validate warehouse ID with Shipway API
      if (role === 'vendor' && warehouseId) {
        try {
          // Validate warehouse ID format
          if (!shipwayService.validateWarehouseId(warehouseId)) {
            return res.status(400).json({
              success: false,
              message: 'Invalid warehouse ID format'
            });
          }

          // Fetch warehouse details from Shipway
          const warehouseData = await shipwayService.getWarehouseById(warehouseId);
          
          if (!warehouseData.success) {
            return res.status(400).json({
              success: false,
              message: 'Invalid warehouse ID or warehouse not found'
            });
          }

          // Store warehouse details in user data
          const formattedWarehouse = shipwayService.formatWarehouseData(warehouseData.data);
          
          // Hash password
          const hashedPassword = await hashPassword(password);

          // Create user with warehouse details
          const userData = {
            name,
            email,
            phone,
            password: hashedPassword,
            role,
            status,
            warehouseId,
            warehouseDetails: formattedWarehouse,
            contactNumber
          };

          const newUser = database.createUser(userData);

          res.status(201).json({
            success: true,
            message: `${role} created successfully`,
            data: newUser
          });

        } catch (shipwayError) {
          console.error('Shipway API error:', shipwayError);
          return res.status(400).json({
            success: false,
            message: `Failed to validate warehouse: ${shipwayError.message}`
          });
        }
      } else {
        // For admins or users without warehouse
        const hashedPassword = await hashPassword(password);

        const userData = {
          name,
          email,
          phone,
          password: hashedPassword,
          role,
          status,
          warehouseId,
          contactNumber
        };

        const newUser = database.createUser(userData);

        res.status(201).json({
          success: true,
          message: `${role} created successfully`,
          data: newUser
        });
      }

    } catch (error) {
      console.error('Create user error:', error);
      
      if (error.message.includes('already exists')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Get all users with pagination and filtering
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getAllUsers(req, res) {
    try {
      const { page = 1, limit = 10, role, status, q: searchQuery } = req.query;
      
      let users = database.getAllUsers();

      // Filter by role
      if (role) {
        users = users.filter(user => user.role === role);
      }

      // Filter by status
      if (status) {
        users = users.filter(user => user.status === status);
      }

      // Search functionality
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        users = users.filter(user => 
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          (user.phone && user.phone.includes(query))
        );
      }

      // Remove superadmin from results (optional - for security)
      users = users.filter(user => user.role !== 'superadmin');

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = pageNum * limitNum;
      
      const paginatedUsers = users.slice(startIndex, endIndex);
      const totalUsers = users.length;
      const totalPages = Math.ceil(totalUsers / limitNum);

      // Remove passwords from response
      const usersWithoutPasswords = paginatedUsers.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });

      res.json({
        success: true,
        data: {
          users: usersWithoutPasswords,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalUsers,
            hasNextPage: endIndex < totalUsers,
            hasPrevPage: pageNum > 1
          }
        }
      });

    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Get user by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getUserById(req, res) {
    try {
      const { id } = req.params;

      const user = database.getUserById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Remove password from response
      const { password, ...userWithoutPassword } = user;

      res.json({
        success: true,
        data: userWithoutPassword
      });

    } catch (error) {
      console.error('Get user by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Update user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Check if user exists
      const existingUser = database.getUserById(id);
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // If updating warehouse ID for vendor, validate with Shipway
      if (updateData.warehouseId && existingUser.role === 'vendor') {
        try {
          if (!shipwayService.validateWarehouseId(updateData.warehouseId)) {
            return res.status(400).json({
              success: false,
              message: 'Invalid warehouse ID format'
            });
          }

          const warehouseData = await shipwayService.getWarehouseById(updateData.warehouseId);
          
          if (!warehouseData.success) {
            return res.status(400).json({
              success: false,
              message: 'Invalid warehouse ID or warehouse not found'
            });
          }

          const formattedWarehouse = shipwayService.formatWarehouseData(warehouseData.data);
          updateData.warehouseDetails = formattedWarehouse;

        } catch (shipwayError) {
          console.error('Shipway API error:', shipwayError);
          return res.status(400).json({
            success: false,
            message: `Failed to validate warehouse: ${shipwayError.message}`
          });
        }
      }

      // Update user
      const updatedUser = database.updateUser(id, updateData);

      if (!updatedUser) {
        return res.status(500).json({
          success: false,
          message: 'Failed to update user'
        });
      }

      res.json({
        success: true,
        message: 'User updated successfully',
        data: updatedUser
      });

    } catch (error) {
      console.error('Update user error:', error);
      
      if (error.message.includes('already exists')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Delete user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      // Check if user exists
      const user = database.getUserById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Prevent deletion of superadmin
      if (user.role === 'superadmin') {
        return res.status(403).json({
          success: false,
          message: 'Cannot delete superadmin user'
        });
      }

      // Delete user
      const deleted = database.deleteUser(id);

      if (!deleted) {
        return res.status(500).json({
          success: false,
          message: 'Failed to delete user'
        });
      }

      res.json({
        success: true,
        message: 'User deleted successfully'
      });

    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Get users by role
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getUsersByRole(req, res) {
    try {
      const { role } = req.params;

      if (!['admin', 'vendor'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Must be admin or vendor'
        });
      }

      const users = database.getUsersByRole(role);

      // Remove passwords from response
      const usersWithoutPasswords = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });

      res.json({
        success: true,
        data: usersWithoutPasswords
      });

    } catch (error) {
      console.error('Get users by role error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Get users by status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getUsersByStatus(req, res) {
    try {
      const { status } = req.params;

      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be active or inactive'
        });
      }

      const users = database.getUsersByStatus(status);

      // Remove passwords from response
      const usersWithoutPasswords = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });

      res.json({
        success: true,
        data: usersWithoutPasswords
      });

    } catch (error) {
      console.error('Get users by status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Toggle user status (active/inactive)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async toggleUserStatus(req, res) {
    try {
      const { id } = req.params;

      const user = database.getUserById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const newStatus = user.status === 'active' ? 'inactive' : 'active';
      const updatedUser = database.updateUser(id, { status: newStatus });

      if (!updatedUser) {
        return res.status(500).json({
          success: false,
          message: 'Failed to update user status'
        });
      }

      res.json({
        success: true,
        message: `User status changed to ${newStatus}`,
        data: updatedUser
      });

    } catch (error) {
      console.error('Toggle user status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

module.exports = new UserController(); 