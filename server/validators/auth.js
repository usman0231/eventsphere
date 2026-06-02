const { body } = require('express-validator');

// Validation rule sets for the auth endpoints. Kept lenient where the model /
// existing flow already coerces (e.g. role), strict on the security-relevant bits.

exports.registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }).withMessage('Name is too long'),
  body('email').trim().isEmail().withMessage('A valid email is required'),
  body('password').isString().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional({ values: 'falsy' }).isIn(['attendee', 'exhibitor']).withMessage('Invalid role'),
  body('phone').optional({ values: 'falsy' }).isLength({ max: 30 }).withMessage('Phone is too long'),
  body('company').optional({ values: 'falsy' }).isLength({ max: 120 }).withMessage('Company name is too long'),
];

exports.loginRules = [
  body('email').trim().isEmail().withMessage('A valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

exports.forgotPasswordRules = [
  body('email').trim().isEmail().withMessage('A valid email is required'),
];

exports.resetPasswordRules = [
  body('password').isString().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

exports.resendVerificationRules = [
  body('email').trim().isEmail().withMessage('A valid email is required'),
];
