const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required."],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters long."],
      // Optional: Add a match regex for allowed username characters if needed
      // match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores.']
    },
    firstName: {
      type: String,
      required: [true, "First name is required."],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required."],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email address is required."],
      unique: true,
      // sparse: true, // Not strictly necessary since email is required, but harmless.
      lowercase: true, // Ensures email is stored in lowercase for consistent lookups
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, // Improved regex
        "Please provide a valid email address.",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required."],
      minlength: [6, "Password must be at least 6 characters long."],
      select: false, // IMPORTANT: Do not return password by default
    },
    state: {
      type: String,
      trim: true,
      // Example: if state is a predefined list
      // enum: {
      //   values: ["Lagos", "Abuja", "Kano", "Rivers", "Other"],
      //   message: "'{VALUE}' is not a supported state."
      // }
    },
    walletBalance: {
      type: Number,
      required: [true, "Wallet balance is required."], // Make it explicitly required if every user must have one.
      default: 1000,
      min: [0, "Wallet balance cannot be negative."],
      // Custom setter to ensure two decimal places if needed at schema level (advanced)
      // set: val => parseFloat(val.toFixed(2))
    },
    role: {
      type: String,
      enum: {
        values: ["user", "admin"],
        message: 'Role "{VALUE}" is not supported. Must be "user" or "admin".',
      },
      default: "user",
    },
    // Fields for password reset
    passwordResetToken: {
      type: String,
      select: false, // IMPORTANT: Do not return by default
    },
    passwordResetExpires: {
      type: Date,
      select: false, // IMPORTANT: Do not return by default
    },
    // Optional: Track when the password was last changed for security purposes
    // passwordChangedAt: Date,
  },
  { timestamps: true } // Adds createdAt and updatedAt
);

// Indexes for username and email are automatically created due to `unique: true`.
// Additional indexes can be added if there are frequent queries on other fields.
// e.g., if admins frequently search or list users by role:
// userSchema.index({ role: 1 });

// Example of a virtual for full name (not strictly an "improvement" but a Mongoose feature)
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtuals are included when converting to JSON or Object
userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("User", userSchema);
