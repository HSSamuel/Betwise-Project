const User = require("../models/User");
const bcrypt = require("bcryptjs");
const Bet = require("../models/Bet"); // For fetching user's betting summary
const Transaction = require("../models/Transaction"); // For fetching user's transaction summary

// Get current user's profile
exports.getProfile = async (req, res) => {
  try {
    // req.user is populated by auth middleware and password is already excluded
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ msg: "User not found." });
    }
    res.json(user);
  } catch (err) {
    console.error("Error fetching profile:", err.message);
    res.status(500).json({ msg: "Server error while fetching profile." });
  }
};

// Change current user's email
exports.changeEmail = async (req, res) => {
  const { newEmail, currentPassword } = req.body; // Require current password to change email for security

  if (!newEmail || !currentPassword) {
    return res
      .status(400)
      .json({ msg: "New email and current password are required." });
  }

  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  if (!emailRegex.test(newEmail)) {
    return res.status(400).json({ msg: "Invalid email format." });
  }

  try {
    const user = await User.findById(req.user.id); // Fetch user with password
    if (!user) {
      return res.status(404).json({ msg: "User not found." });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Incorrect current password." });
    }

    // Check if the new email is already in use by another user
    if (newEmail.toLowerCase() === user.email.toLowerCase()) {
      return res
        .status(400)
        .json({ msg: "New email cannot be the same as the current email." });
    }
    const emailExists = await User.findOne({ email: newEmail.toLowerCase() });
    if (emailExists) {
      return res
        .status(400)
        .json({ msg: "This email address is already in use." });
    }

    user.email = newEmail.toLowerCase();
    await user.save();

    res.json({ msg: "Email updated successfully." });
  } catch (err) {
    console.error("Error changing email:", err.message);
    if (err.code === 11000) {
      // Mongoose duplicate key error for email
      return res
        .status(400)
        .json({ msg: "This email address is already in use." });
    }
    res.status(500).json({ msg: "Server error while changing email." });
  }
};

// Change current user's password
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmNewPassword) {
    return res
      .status(400)
      .json({
        msg: "Current password, new password, and confirmation are required.",
      });
  }
  if (newPassword !== confirmNewPassword) {
    return res
      .status(400)
      .json({ msg: "New password and confirmation password do not match." });
  }
  if (newPassword.length < 6) {
    return res
      .status(400)
      .json({ msg: "New password must be at least 6 characters long." });
  }
  // Optional: Add password complexity check for newPassword here

  try {
    const user = await User.findById(req.user.id); // Fetch user with password
    if (!user) {
      return res.status(404).json({ msg: "User not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Incorrect current password." });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ msg: "Password updated successfully." });
  } catch (err) {
    console.error("Error changing password:", err.message);
    res.status(500).json({ msg: "Server error while changing password." });
  }
};
