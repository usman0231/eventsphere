const { validationResult } = require('express-validator');

// Runs after a set of express-validator rules. If any failed, respond 422 with
// the first message (for toasts) plus a per-field list (for inline form errors).
module.exports = function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array();
  return res.status(422).json({
    success: false,
    message: errors[0].msg,
    errors: errors.map((e) => ({ field: e.path, message: e.msg })),
  });
};
