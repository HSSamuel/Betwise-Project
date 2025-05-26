const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// User Registration
exports.register = async (req, res) => {
  // Destructure new fields from request body
  const { username, email, password, firstName, lastName, state } = req.body;

  // --- Input Validation ---
  if (!username || !email || !password || !firstName || !lastName) {
    // Added firstName, lastName to check
    return res.status(400).json({
      msg: "Please provide username, email, password, firstName, and lastName.",
    });
  }
  if (username.length < 3) {
    return res
      .status(400)
      .json({ msg: "Username must be at least 3 characters long." });
  }
  if (firstName.trim().length === 0) {
    return res.status(400).json({ msg: "First name cannot be empty." });
  }
  if (lastName.trim().length === 0) {
    return res.status(400).json({ msg: "Last name cannot be empty." });
  }
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ msg: "Invalid email format." });
  }
  if (password.length < 6) {
    return res
      .status(400)
      .json({ msg: "Password must be at least 6 characters long." });
  }
  // Optional: Add validation for 'state' if it becomes required or has specific formats/values
  // For example, if state is required:
  // if (!state || state.trim().length === 0) {
  //   return res.status(400).json({ msg: "State is required." });
  // }

  try {
    // Check if username or email already exists (case-insensitive)
    let user = await User.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() },
      ],
    });
    if (user) {
      if (user.username === username.toLowerCase()) {
        return res.status(400).json({ msg: "Username already taken." });
      }
      if (user.email === email.toLowerCase()) {
        return res.status(400).json({ msg: "Email already in use." });
      }
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user, including new fields
    user = new User({
      username: username.toLowerCase(), // Store username in lowercase
      firstName,
      lastName,
      email: email.toLowerCase(), // Store email in lowercase
      password: hashedPassword,
      state: state ? state.trim() : null, // Save state (trimmed), or null if not provided and optional
    });

    await user.save();

    // Generate JWT token
    const payload = { id: user._id, role: user.role, username: user.username };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    });

    res.status(201).json({
      msg: "User registered successfully.", // "message" in screenshot would be "Login successful" for login
      token: token, // "accessToken" in screenshot
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
    if (error.code === 11000) {
      // Mongoose duplicate key error
      return res.status(400).json({ msg: "Username or email already exists." });
    }
    if (error.name === "ValidationError") {
      // Extract and send specific validation errors
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ msg: messages.join(", ") });
    }
    res.status(500).json({ msg: "Server error during registration." });
  }
};

// User Login
exports.login = async (req, res) => {
  // The screenshot shows login with email. Let's adjust for that.
  const { email, password } = req.body;

  // Input Validation
  if (!email || !password) {
    return res
      .status(400)
      .json({ msg: "Please provide both email and password." });
  }

  try {
    // Find the user by email (case-insensitive)
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials." }); // Generic message
    }

    // Check if the password is correct
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials." }); // Generic message
    }

    // Generate JWT token
    const payload = { id: user._id, role: user.role, username: user.username };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    });

    // Structure the response to be similar to the screenshot
    res.json({
      message: "Login successful", // Matches screenshot
      accessToken: token, // Matches screenshot
      // refreshToken: "your_refresh_token_logic_here", // Add if you implement refresh tokens
      user: {
        // id: user._id, // Not in screenshot's user object, but you can include if needed
        // username: user.username, // Not in screenshot's user object
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        state: user.state,
        role: user.role,
        // walletBalance: user.walletBalance // Not in screenshot's user object
      },
    });
  } catch (error) {
    console.error("Error in user login:", error.message);
    res.status(500).json({ msg: "Server error during login." });
  }
};
