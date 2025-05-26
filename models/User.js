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
      // New field
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      // New field
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      sparse: true, // Allows multiple documents to have a null value for this field if not unique
      lowercase: true, // Converts email to lowercase
      trim: true,
      // Basic email format validation using Mongoose's match validator
      match: [
        /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/,
        "Please fill a valid email address",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"], // Basic length validation
    },
    state: {
      // New field
      type: String,
      trim: true,
      // Example: Make it required
      // required: [true, "State is required"],
      // Example: Provide a list of valid states (enum)
      // enum: ["Delta", "Lagos", "Abuja", "Rivers"], // Add your list of states
    },
    walletBalance: {
      type: Number,
      default: 1000, // Default wallet balance for new users
      min: [0, "Wallet balance cannot be negative"],
    },
    role: {
      type: String,
      enum: ["user", "admin"], // Defines allowed roles
      default: "user", // Default role for new users
    },
  },
  { timestamps: true } // Automatically adds createdAt and updatedAt fields
);

module.exports = mongoose.model("User", userSchema);
