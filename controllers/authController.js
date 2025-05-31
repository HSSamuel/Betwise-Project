const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");

// --- Helper function to generate tokens ---
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

// --- Helper function to send email ---
const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "gmail", // Consider more secure ways for credentials in prod
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from:
      process.env.EMAIL_FROM ||
      `"${process.env.EMAIL_FROM_NAME || "BetWise Support"}" <${
        process.env.EMAIL_USER
      }>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  try {
    await transporter.sendMail(mailOptions);
    // console.log("Email sent successfully."); // Use a proper logger
  } catch (error) {
    // console.error("Error sending email:", error); // Use a proper logger
    // Let the caller handle the implications of email sending failure.
    throw new Error(
      "Email could not be sent due to a server configuration issue."
    );
  }
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

// --- User Registration ---
exports.register = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, password, firstName, lastName, state } = req.body;

  try {
    const lowercasedUsername = username.toLowerCase();
    const lowercasedEmail = email.toLowerCase();

    let user = await User.findOne({
      $or: [{ username: lowercasedUsername }, { email: lowercasedEmail }],
    });
    if (user) {
      return res.status(400).json({ msg: "Username or email already exists." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      username: lowercasedUsername,
      firstName,
      lastName,
      email: lowercasedEmail,
      password: hashedPassword,
      state: state ? state.trim() : undefined, // Ensure state is undefined if empty after trim
    });

    await user.save();

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // TODO: Consider storing hashed refresh token in DB for enhanced security

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
    // Mongoose unique index violation (code 11000) for username or email
    if (error.code === 11000) {
      return res.status(400).json({ msg: "Username or email already exists." });
    }
    next(error);
  }
};

// --- User Login ---
exports.login = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    ); // Ensure password is selected
    if (!user) {
      return res
        .status(401)
        .json({ msg: "Invalid credentials. User not found." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ msg: "Invalid credentials. Password incorrect." });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // TODO: Consider storing hashed refresh token in DB for enhanced security

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

// --- Refresh Access Token ---
exports.refreshToken = async (req, res, next) => {
  const { token } = req.body; // This is the refresh token

  if (!token) {
    return res.status(401).json({ msg: "Refresh token is required." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res
        .status(403)
        .json({ msg: "Invalid refresh token or user not found." });
    }

    // TODO: Implement refresh token validation against stored (hashed) token in DB
    // If (user.refreshToken !== hash(token) || user.refreshTokenExpires < Date.now()) {
    //    return res.status(403).json({ msg: "Refresh token is invalid, expired, or has been revoked." });
    // }

    const newAccessToken = generateAccessToken(user);
    res.json({
      accessToken: newAccessToken,
    });
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res
        .status(403)
        .json({ msg: "Refresh token is invalid or expired." });
    }
    next(err);
  }
};

// --- Request Password Reset ---
exports.requestPasswordReset = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { email } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // console.log(`Password reset attempt for non-existent email: ${email}`); // Use logger
      return res.status(200).json({
        msg: "If your email address is registered with us, you will receive a password reset link shortly.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save({ validateBeforeSave: false });

    const appName = process.env.APP_NAME || "BetWise";
    const resetUrl = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/reset-password/${resetToken}`;
    const messageText = `You are receiving this email because you (or someone else) have requested the reset of a password for your ${appName} account.\n\nPlease click on the following link, or paste this into your browser to complete the process within 10 minutes of receiving it:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email and your password will remain unchanged.\n\nThanks,\nThe ${appName} Team`;

    try {
      await sendEmail({
        email: user.email,
        subject: `Your ${appName} Password Reset Token (valid for 10 min)`,
        message: messageText,
      });
      res.status(200).json({
        msg: "If your email address is registered with us, you will receive a password reset link shortly.",
      });
    } catch (emailError) {
      // If email sending fails, we should ideally not leave an unusable token in the DB.
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      // console.error("EMAIL SENDING ERROR (requestPasswordReset):", emailError.message); // Use logger
      // Do not inform the client about the email sending failure directly, to prevent user enumeration.
      // Instead, rely on the global error handler for server errors or return a generic "try again" for client.
      // For a critical server-side issue like this, passing to next(err) is appropriate.
      // The error thrown by sendEmail helper might be too generic.
      // We can create a more specific error or log it and pass a generic one.
      const serverError = new Error(
        "The server encountered an error trying to send the password reset email. Please try again later."
      );
      serverError.statusCode = 500; // Internal Server Error
      next(serverError);
    }
  } catch (error) {
    next(error);
  }
};

// --- Reset Password ---
exports.resetPassword = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { password } = req.body; // confirmPassword already checked by validator
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
    // user.passwordChangedAt = Date.now(); // Optional: for security audits

    await user.save(); // This will trigger full Mongoose validation

    res.status(200).json({
      msg: "Password has been reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    next(error);
  }
};
