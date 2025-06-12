const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const TokenBlacklist = require("../models/TokenBlacklist");
const { sendEmail } = require("../services/emailService"); // <-- IMPORT from new service

// --- Helper Functions ---
const generateAccessToken = (user) => {
  const payload = { id: user._id, role: user.role, username: user.username };
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });
};

const generateRefreshToken = (user) => {
  const payload = { id: user._id, username: user.username };
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  });
};

// --- Validation Rules ---
exports.validateRegister = [
  body("username")
    .trim()
    .isLength({ min: 3 })
    .withMessage("Username must be at least 3 characters long.")
    .escape(),
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email address.")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long."),
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required.")
    .escape(),
  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required.")
    .escape(),
  body("state").optional().trim().escape(),
];
exports.validateLogin = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email address.")
    .normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required."),
];
exports.validateRequestPasswordReset = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email address.")
    .normalizeEmail(),
];
exports.validateResetPassword = [
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long."),
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Passwords do not match.");
    }
    return true;
  }),
];

// --- Controller Functions ---

exports.register = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { username, email, password, firstName, lastName, state } = req.body;
  try {
    let user = await User.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() },
      ],
    });
    if (user) {
      return res.status(400).json({ msg: "Username or email already exists." });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    user = new User({
      username: username.toLowerCase(),
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: hashedPassword,
      state: state ? state.trim() : undefined,
    });
    await user.save();
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    res.status(201).json({
      msg: "User registered successfully.",
      accessToken: accessToken,
      refreshToken: refreshToken,
      user: {
        id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        state: user.state,
        role: user.role,
        walletBalance: user.walletBalance,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ msg: "Username or email already exists." });
    }
    next(error);
  }
};

exports.login = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );
    if (!user) {
      const err = new Error("Invalid credentials.");
      err.statusCode = 401;
      return next(err);
    }

    // --- ADDED THIS BLOCK ---
    // Check if the user registered via social media (i.e., has no password)
    if (!user.password) {
      const err = new Error(
        "This account was created using a social login. Please sign in with Google or Facebook."
      );
      err.statusCode = 400; // Bad Request, as they are using the wrong login method
      return next(err);
    }
    // --- END ADDED BLOCK ---

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const err = new Error("Invalid credentials.");
      err.statusCode = 401;
      return next(err);
    }
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    res.json({
      message: "Login successful",
      accessToken: accessToken,
      refreshToken: refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        state: user.state,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");
    const token = authHeader.replace("Bearer ", "");
    const decoded = jwt.decode(token);
    const expiresAt = new Date(decoded.exp * 1000);
    await new TokenBlacklist({ token, expiresAt }).save();
    res.status(200).json({ msg: "You have been logged out successfully." });
  } catch (error) {
    next(error);
  }
};

exports.refreshToken = async (req, res, next) => {
  const { token } = req.body;
  if (!token) {
    const err = new Error("Refresh token is required.");
    err.statusCode = 401;
    return next(err);
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      const err = new Error("Invalid refresh token or user not found.");
      err.statusCode = 403; // Forbidden
      return next(err);
    }
    const newAccessToken = generateAccessToken(user);
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      const error = new Error("Refresh token is invalid or expired.");
      error.statusCode = 403;
      return next(error);
    }
    next(err);
  }
};

// --- Social Login Callback ---
exports.socialLoginCallback = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      const err = new Error("User authentication failed.");
      err.statusCode = 401;
      return next(err);
    }
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // --- TEMPORARY CHANGE FOR TESTING ---
    // res.redirect(
    //   `<span class="math-inline">\{process\.env\.FRONTEND\_URL\}/social\-auth\-success?accessToken\=</span>{accessToken}&refreshToken=${refreshToken}`
    // );
    res.json({
      msg: "Social login successful. Here are your details.",
      user: user,
      accessToken: accessToken,
      refreshToken: refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

//     res.redirect(
//       `${process.env.FRONTEND_URL}/social-auth-success?accessToken=${accessToken}&refreshToken=${refreshToken}`
//     );
//   } catch (error) {
//     next(error);
//   }
// };

// --- Password Management Functions ---
exports.requestPasswordReset = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { email } = req.body;
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(200).json({
        msg: "If your email address is registered with us, you will receive a password reset link shortly.",
      });
    }
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
    await user.save({ validateBeforeSave: false });
    const appName = process.env.APP_NAME || "BetWise";
    const resetUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/reset-password/${resetToken}`;
    const messageText = `You are receiving this email because you (or someone else) have requested the reset of a password for your ${appName} account.\n\nPlease click on the following link, or paste this into your browser to complete the process within 10 minutes of receiving it:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email and your password will remain unchanged.\n\nThanks,\nThe ${appName} Team`;
    try {
      await sendEmail({
        to: user.email,
        subject: `Your ${appName} Password Reset Token (valid for 10 min)`,
        message: messageText,
      });
      res.status(200).json({
        msg: "If your email address is registered with us, you will receive a password reset link shortly.",
      });
    } catch (emailError) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      const serverError = new Error(
        "The server encountered an error trying to send the password reset email. Please try again later."
      );
      serverError.statusCode = 500;
      next(serverError);
    }
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { password } = req.body;
  const plainTokenFromUrl = req.params.token;
  try {
    const hashedToken = crypto
      .createHash("sha256")
      .update(plainTokenFromUrl)
      .digest("hex");
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });
    if (!user) {
      return res
        .status(400)
        .json({ msg: "Password reset token is invalid or has expired." });
    }
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    res.status(200).json({
      msg: "Password has been reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    next(error);
  }
};
