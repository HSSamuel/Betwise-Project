const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../models/User");

// --- Helper function to generate tokens ---
const generateAccessToken = (user) => {
  const payload = { id: user._id, role: user.role, username: user.username };
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d", // Access token typically shorter
  });
};

const generateRefreshToken = (user) => {
  const payload = { id: user._id, username: user.username }; // Refresh token might have a simpler payload
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d", // Refresh token typically longer
  });
};

// --- Helper function to send email ---
const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "gmail",
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
    // html: options.html // Optionally add HTML version of email
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully.");
  } catch (error) {
    console.error("Error sending email:", error);
    // Depending on the use case, you might not want to throw an error that stops the whole process,
    // but rather log it and perhaps inform the user through a different channel or a generic message.
    // For critical emails like password reset, throwing an error to be caught by the controller is appropriate.
    throw new Error(
      "There was an error sending the email, please try again later."
    );
  }
};

// --- User Registration ---
exports.register = async (req, res, next) => {
  const { username, email, password, firstName, lastName, state } = req.body;

  if (!username || !email || !password || !firstName || !lastName) {
    return res.status(400).json({
      msg: "Please provide username, email, password, firstName, and lastName.",
    });
  }
  if (username.length < 3)
    return res
      .status(400)
      .json({ msg: "Username must be at least 3 characters." });
  if (password.length < 6)
    return res
      .status(400)
      .json({ msg: "Password must be at least 6 characters." });
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  if (!emailRegex.test(email))
    return res.status(400).json({ msg: "Invalid email format." });

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
      state: state ? state.trim() : null,
      // walletBalance is handled by schema default
      // role is handled by schema default
    });

    await user.save();

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(201).json({
      msg: "User registered successfully.",
      accessToken: accessToken,
      refreshToken: refreshToken, // Include refresh token in registration response as well
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
    console.error("Error in user registration:", error.message);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ msg: messages.join(", ") });
    }
    // Pass to centralized error handler if not a validation error
    next(error);
  }
};

// --- User Login ---
exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ msg: "Please provide both email and password." });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ msg: "Invalid credentials." }); // 401 for auth failure
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ msg: "Invalid credentials." }); // 401 for auth failure
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Optionally: Store refresh token in DB associated with user for better security and management
    // For simplicity, we are not storing it in this iteration.
    // user.refreshToken = refreshToken; // Example if you add a field to User model
    // await user.save();

    res.json({
      message: "Login successful",
      accessToken: accessToken,
      refreshToken: refreshToken,
      user: {
        id: user._id, // Include user ID
        username: user.username, // Include username
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        state: user.state,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error in user login:", error.message);
    next(error);
  }
};

// --- Refresh Access Token ---
exports.refreshToken = async (req, res, next) => {
  const { token } = req.body;

  if (!token) {
    return res.status(401).json({ msg: "Refresh token is required." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    // Find user based on decoded token (e.g., by ID)
    // Important: Ensure the refresh token hasn't been revoked (if implementing revocation)
    const user = await User.findById(decoded.id);

    if (!user) {
      return res
        .status(403)
        .json({ msg: "Invalid refresh token or user not found." }); // 403 Forbidden
    }

    // Optionally: Check if this refresh token is still valid/active in your DB if you store them
    // if (user.refreshToken !== token) { // Example check
    //    return res.status(403).json({ msg: "Refresh token is no longer valid." });
    // }

    const newAccessToken = generateAccessToken(user);

    res.json({
      accessToken: newAccessToken,
    });
  } catch (err) {
    console.error("Error refreshing token:", err.message);
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res
        .status(403)
        .json({ msg: "Refresh token is invalid or expired." }); // 403 Forbidden
    }
    next(err); // Pass to centralized error handler
  }
};

// --- Request Password Reset ---
exports.requestPasswordReset = async (req, res, next) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ msg: "Please provide an email address." });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // To prevent email enumeration, always return a generic success message
      console.log(`Password reset attempt for non-existent email: ${email}`);
      return res.status(200).json({
        msg: "If your email address is registered with us, you will receive a password reset link shortly.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // Token valid for 10 minutes

    await user.save({ validateBeforeSave: false }); // Skip validation for these specific fields

    // UPDATED SECTION FOR EMAIL CONTENT
    const appName = process.env.APP_NAME || "BetWise"; // Use APP_NAME from .env or default to "BetWise"
    const resetUrl = `${
      process.env.FRONTEND_URL || "http://localhost:8000"
    }/reset-password/${resetToken}`; // Ensure FRONTEND_URL is in .env
    const messageText = `You are receiving this email because you (or someone else) have requested the reset of a password for your ${appName} account.\n\nPlease click on the following link, or paste this into your browser to complete the process within 10 minutes of receiving it:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email and your password will remain unchanged.\n\nThanks,\nThe ${appName} Team`;

    try {
      await sendEmail({
        email: user.email,
        subject: `Your ${appName} Password Reset Token (valid for 10 min)`, // Updated subject
        message: messageText,
      });
      res.status(200).json({
        msg: "If your email address is registered with us, you will receive a password reset link shortly.",
      });
    } catch (emailError) {
      // If email sending fails, we should not leave the reset token in the DB as it's unusable.
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      console.error(
        "EMAIL SENDING ERROR (requestPasswordReset):",
        emailError.message
      );
      // It's important to inform the user that something went wrong, but avoid too many details.
      return res.status(500).json({
        msg: "There was an error processing your request. Please try again later.",
      });
    }
  } catch (error) {
    console.error("REQUEST PASSWORD RESET ERROR:", error);
    next(error);
  }
};

// --- Reset Password ---
exports.resetPassword = async (req, res, next) => {
  const { password, confirmPassword } = req.body;
  const plainTokenFromUrl = req.params.token;

  if (!password || !confirmPassword) {
    return res
      .status(400)
      .json({ msg: "Please provide new password and confirm password." });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ msg: "Passwords do not match." });
  }
  if (password.length < 6) {
    return res
      .status(400)
      .json({ msg: "Password must be at least 6 characters long." });
  }

  try {
    const hashedToken = crypto
      .createHash("sha256")
      .update(plainTokenFromUrl)
      .digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }, // Check if token is not expired
    });

    if (!user) {
      return res
        .status(400)
        .json({ msg: "Password reset token is invalid or has expired." });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.passwordResetToken = undefined; // Clear the reset token
    user.passwordResetExpires = undefined; // Clear the expiry
    // user.passwordChangedAt = Date.now(); // Optional: track when password was last changed

    await user.save(); // This will now trigger full validation

    // Optionally, log the user in directly or send a confirmation email
    // For now, just a success message.

    res.status(200).json({
      msg: "Password has been reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ msg: messages.join(", ") });
    }
    next(error);
  }
};
