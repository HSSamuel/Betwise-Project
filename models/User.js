const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters long"],
    },
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/,
        "Please fill a valid email address",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
    },
    state: {
      type: String,
      trim: true,
    },
    walletBalance: {
      type: Number,
      default: 1000,
      min: [0, "Wallet balance cannot be negative"],
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    // Fields for password reset
    passwordResetToken: {
      type: String,
      default: undefined, // Or select: false if you don't want it returned by default
    },
    passwordResetExpires: {
      type: Date,
      default: undefined, // Or select: false
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
