const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Middleware to authenticate user via JWT
exports.auth = async (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ msg: "No token, authorization denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ msg: "User not found" });
    }

    req.user = user; // Attach user to request
    next();
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(401).json({ msg: "Invalid or expired token" });
  }
};

// Middleware to restrict access to admins only
exports.isAdmin = (req, res, next) => {
  if (req.user?.role === "admin") {
    return next();
  }
  return res.status(403).json({ msg: "Access denied: Admins only" });
};
