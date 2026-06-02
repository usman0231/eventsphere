const { body } = require('express-validator');

const TIERS = ['platinum', 'gold', 'silver', 'bronze', 'startup'];

// Shared field rules (used on both create and update).
const common = [
  body('name').optional().trim().notEmpty().withMessage('Sponsor name is required').isLength({ max: 120 }).withMessage('Name is too long'),
  body('tier').optional({ values: 'falsy' }).isIn(TIERS).withMessage('Invalid tier'),
  body('website').optional({ values: 'falsy' }).isURL().withMessage('Website must be a valid URL'),
  body('contactEmail').optional({ values: 'falsy' }).isEmail().withMessage('Invalid contact email'),
  body('description').optional({ values: 'falsy' }).isLength({ max: 1000 }).withMessage('Description is too long'),
];

exports.createSponsorRules = [
  body('expo').isMongoId().withMessage('A valid expo is required'),
  body('name').trim().notEmpty().withMessage('Sponsor name is required').isLength({ max: 120 }).withMessage('Name is too long'),
  ...common,
];

exports.updateSponsorRules = common;
