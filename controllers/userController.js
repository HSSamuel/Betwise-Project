const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
// const Bet = require("../models/Bet"); // Removed if not used
// const Transaction = require("../models/Transaction"); // Removed if not used

// --- Validation Rules ---
exports.validateChangeEmail = [
  body("newEmail")
    .isEmail()
    .withMessage("Please provide a valid new email address.")
    .normalizeEmail(),
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required."),
];

exports.validateChangePassword = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required."),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters long."),
  // Optional: Add custom password complexity rules here if desired
  // .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/)
  // .withMessage('Password must be at least 8 characters long and include uppercase, lowercase, and a number.'),
  body("confirmNewPassword").custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error("New password and confirmation password do not match.");
    }
    return true;
  }),
];

// Get current user's profile
exports.getProfile = async (req, res, next) => {
  try {
    // req.user is populated by auth middleware.
    // Password should already be excluded by auth middleware if .select('-password') was used there.
    // Or, it is excluded by default if select: false in User model schema.
    // However, re-selecting here ensures it if not handled elsewhere.
    const user = await User.findById(req.user.id).select("-password").lean(); // Use lean for performance
    if (!user) {
      const err = new Error("User profile not found.");
      err.statusCode = 404;
      return next(err);
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
};

// Change current user's email
exports.changeEmail = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { newEmail, currentPassword } = req.body; // newEmail is already normalized

  try {
    const user = await User.findById(req.user.id); // Need full document to compare password
    if (!user) {
      const err = new Error("User not found."); // Should be rare if token is valid
      err.statusCode = 404;
      return next(err);
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      const err = new Error("Incorrect current password provided.");
      err.statusCode = 401; // Unauthorized
      return next(err);
    }

    if (newEmail === user.email) {
      // user.email should be consistently lowercase from registration/updates
      const err = new Error(
        "New email cannot be the same as the current email."
      );
      err.statusCode = 400;
      return next(err);
    }

    // Check if the new email is already in use by ANOTHER user
    const emailExists = await User.findOne({ email: newEmail });
    if (emailExists && emailExists._id.toString() !== user._id.toString()) {
      const err = new Error(
        "This email address is already in use by another account."
      );
      err.statusCode = 400; // Conflict or Bad Request
      return next(err);
    }

    user.email = newEmail; // newEmail is already lowercased by normalizeEmail()
    await user.save();

    res.json({ msg: "Email updated successfully." });
  } catch (error) {
    // Handle potential race condition for unique email index (though less likely with prior checks)
    if (error.code === 11000) {
      const customError = new Error("This email address is already in use.");
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

// Change current user's password
exports.changePassword = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { currentPassword, newPassword } = req.body; // confirmNewPassword used in validator

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      const err = new Error("User not found.");
      err.statusCode = 404;
      return next(err);
    }

    const isCurrentPasswordMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordMatch) {
      const err = new Error("Incorrect current password.");
      err.statusCode = 401; // Unauthorized
      return next(err);
    }

    // Check if new password is the same as the old one
    const isNewPasswordSameAsOld = await bcrypt.compare(
      newPassword,
      user.password
    );
    if (isNewPasswordSameAsOld) {
      const err = new Error(
        "New password cannot be the same as the current password."
      );
      err.statusCode = 400;
      return next(err);
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    // user.passwordChangedAt = Date.now(); // Optional: for security logging or invalidating old tokens
    await user.save();

    res.json({ msg: "Password updated successfully." });
  } catch (error) {
    next(error);
  }
};
