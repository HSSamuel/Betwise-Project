const jwt = require("jsonwebtoken");
const User = require("../models/User"); // Adjust path if your models are elsewhere

// Middleware to authenticate users via JWT
exports.auth = async (req, res, next) => {
  const authHeader = req.header("Authorization");

  // Check if Authorization header is present and correctly formatted
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      msg: "No token, authorization denied. Please include a Bearer token.",
    });
  }

  const token = authHeader.replace("Bearer ", ""); // Extract token

  try {
    // Verify the token using the JWT secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find the user by ID from the token, excluding the password
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res
        .status(401)
        .json({ msg: "User not found, authorization denied." });
    }

    // Attach the user object to the request for use in subsequent handlers
    req.user = user;
    next(); // Proceed to the next middleware or route handler
  } catch (err) {
    console.error("Auth error:", err.message);
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ msg: "Token is not valid." });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ msg: "Token has expired." });
    }
    res.status(500).json({ msg: "Server error during authentication." });
  }
};

// Middleware to authorize admin users
exports.isAdmin = (req, res, next) => {
  // Check if the authenticated user (from `auth` middleware) has the 'admin' role
  if (req.user && req.user.role === "admin") {
    next(); // User is an admin, proceed
  } else {
    // User is not an admin or user object is not present
    res.status(403).json({ msg: "Access denied: Admin privileges required." });
  }
};
