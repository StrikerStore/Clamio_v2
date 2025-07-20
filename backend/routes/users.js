const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, requireSuperadmin } = require('../middleware/auth');
const { 
  validateUserRegistration, 
  validateUserUpdate, 
  validateUserId, 
  validatePagination, 
  validateSearch 
} = require('../middleware/validation');

/**
 * User Management Routes
 * Handles CRUD operations for users (admin/vendor)
 * All routes require superadmin authentication
 */

// Apply authentication and authorization to all routes
router.use(authenticateToken);
router.use(requireSuperadmin);

/**
 * @route   POST /api/users
 * @desc    Create a new user (admin or vendor)
 * @access  Superadmin only
 */
router.post('/', validateUserRegistration, userController.createUser);

/**
 * @route   GET /api/users
 * @desc    Get all users with pagination and filtering
 * @access  Superadmin only
 */
router.get('/', validatePagination, validateSearch, userController.getAllUsers);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Superadmin only
 */
router.get('/:id', validateUserId, userController.getUserById);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Superadmin only
 */
router.put('/:id', validateUserId, validateUserUpdate, userController.updateUser);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Superadmin only
 */
router.delete('/:id', validateUserId, userController.deleteUser);

/**
 * @route   GET /api/users/role/:role
 * @desc    Get users by role (admin or vendor)
 * @access  Superadmin only
 */
router.get('/role/:role', userController.getUsersByRole);

/**
 * @route   GET /api/users/status/:status
 * @desc    Get users by status (active or inactive)
 * @access  Superadmin only
 */
router.get('/status/:status', userController.getUsersByStatus);

/**
 * @route   PATCH /api/users/:id/toggle-status
 * @desc    Toggle user status (active/inactive)
 * @access  Superadmin only
 */
router.patch('/:id/toggle-status', validateUserId, userController.toggleUserStatus);

module.exports = router; 