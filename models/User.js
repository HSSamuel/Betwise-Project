const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    walletBalance: { type: Number, default: 1000 },
    role: { type: String, enum: ["user", "admin"], default: "user" },
  },
  { timestamps: true }
); // 🕒 Added timestamps

module.exports = mongoose.model("User", userSchema);
