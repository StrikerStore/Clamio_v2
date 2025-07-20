const { body, param, query, validationResult } = require('express-validator');

/**
 * Validation Middleware
 * Handles input validation and sanitization using express-validator
 */

/**
 * Handle validation errors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
  }
  
  next();
};

/**
 * User registration validation rules
 */
const validateUserRegistration = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
  
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage('Please provide a valid phone number'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('role')
    .isIn(['admin', 'vendor'])
    .withMessage('Role must be either admin or vendor'),
  
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be either active or inactive'),
  
  body('warehouseId')
    .optional()
    .isNumeric()
    .withMessage('Warehouse ID must be a number'),
  
  body('contactNumber')
    .optional()
    .trim()
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage('Please provide a valid contact number'),
  
  handleValidationErrors
];

/**
 * User login validation rules
 */
const validateUserLogin = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

/**
 * Phone login validation rules
 */
const validatePhoneLogin = [
  body('phone')
    .trim()
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage('Please provide a valid phone number'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

/**
 * Password reset validation rules
 */
const validatePasswordReset = [
  body('oldPassword')
    .notEmpty()
    .withMessage('Old password is required'),
  
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match new password');
      }
      return true;
    }),
  
  handleValidationErrors
];

/**
 * User update validation rules
 */
const validateUserUpdate = [
  param('id')
    .notEmpty()
    .withMessage('User ID is required'),
  
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
  
  body('email')
    .optional()
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage('Please provide a valid phone number'),
  
  body('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be either active or inactive'),
  
  body('warehouseId')
    .optional()
    .isNumeric()
    .withMessage('Warehouse ID must be a number'),
  
  body('contactNumber')
    .optional()
    .trim()
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage('Please provide a valid contact number'),
  
  handleValidationErrors
];

/**
 * Warehouse ID validation rules
 */
const validateWarehouseId = [
  param('warehouseId')
    .isNumeric()
    .withMessage('Warehouse ID must be a number'),
  
  handleValidationErrors
];

/**
 * User ID validation rules
 */
const validateUserId = [
  param('id')
    .notEmpty()
    .withMessage('User ID is required'),
  
  handleValidationErrors
];

/**
 * Pagination validation rules
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('role')
    .optional()
    .isIn(['admin', 'vendor', 'superadmin'])
    .withMessage('Role must be admin, vendor, or superadmin'),
  
  query('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be either active or inactive'),
  
  handleValidationErrors
];

/**
 * Search validation rules
 */
const validateSearch = [
  query('q')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Search query must be at least 2 characters long'),
  
  handleValidationErrors
];

/**
 * Email validation rule
 */
const validateEmail = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  handleValidationErrors
];

/**
 * Phone validation rule
 */
const validatePhone = [
  body('phone')
    .trim()
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage('Please provide a valid phone number'),
  
  handleValidationErrors
];

/**
 * Custom validation for vendor-specific fields
 */
const validateVendorFields = [
  body('warehouseId')
    .if(body('role').equals('vendor'))
    .notEmpty()
    .withMessage('Warehouse ID is required for vendors')
    .isNumeric()
    .withMessage('Warehouse ID must be a number'),
  
  handleValidationErrors
];

/**
 * Custom validation for admin-specific fields
 */
const validateAdminFields = [
  body('contactNumber')
    .if(body('role').equals('admin'))
    .notEmpty()
    .withMessage('Contact number is required for admins')
    .trim()
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage('Please provide a valid contact number'),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateUserRegistration,
  validateUserLogin,
  validatePhoneLogin,
  validatePasswordReset,
  validateUserUpdate,
  validateWarehouseId,
  validateUserId,
  validatePagination,
  validateSearch,
  validateEmail,
  validatePhone,
  validateVendorFields,
  validateAdminFields
}; 