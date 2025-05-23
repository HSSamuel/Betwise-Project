const User = require("../models/User");
const bcrypt = require("bcryptjs");

// Change email
exports.changeEmail = async (req, res) => {
  const { newEmail } = req.body;
  if (!newEmail) return res.status(400).json({ msg: "New email is required" });

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    user.email = newEmail;
    await user.save();

    res.json({ msg: "Email updated successfully" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res
      .status(400)
      .json({ msg: "Both current and new passwords are required" });

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res.status(400).json({ msg: "Current password is incorrect" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ msg: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};
