const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required."],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters long."],
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
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please provide a valid email address.",
      ],
    },
    password: {
      type: String,
      // required: [true, "Password is required."], A user can sign up with Google/Facebook and not have a password.
      minlength: [
        6,
        "Password must be at least 6 characters long if provided.",
      ],
      select: false,
    },
    state: {
      type: String,
      trim: true,
    },
    // --- GoogleId and facebookId are now top-level fields ---
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values but enforces uniqueness for actual values
    },
    facebookId: {
      type: String,
      unique: true,
      sparse: true,
    },
    // --- End of GoogleId and facebookId ---
    walletBalance: {
      type: Number,
      required: [true, "Wallet balance is required."],
      default: 1000,
      min: [0, "Wallet balance cannot be negative."],
    },
    role: {
      type: String,
      enum: {
        values: ["user", "admin"],
        message: 'Role "{VALUE}" is not supported. Must be "user" or "admin".',
      },
      default: "user",
    },

    // --- FIELD FOR PERSONALIZATION ---
    favoriteLeagues: {
      type: [String], // An array of strings
      default: [], // Defaults to an empty array
    },
    // ------------------------------------

    passwordResetToken: {
      type: String,
      select: false,
    },

    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    // --- NEW FIELD ---
    responsibleGambling: {
      status: {
        type: String,
        enum: ["ok", "at_risk", "restricted"],
        default: "ok",
      },
      lastChecked: {
        type: Date,
      },
      riskFactors: [String], // An array to store reasons for being flagged
    },

    // --- NEW FIELD FOR FRAUD DETECTION ---
    flags: {
      isFlaggedForFraud: {
        type: Boolean,
        default: false,
      },
      fraudReason: {
        type: String,
        default: "",
      },
    },
    // --- FIELD FOR USER-SET LIMITS ---
    limits: {
      weeklyBetCount: {
        limit: { type: Number, default: 0 }, // 0 means no limit
        currentCount: { type: Number, default: 0 },
        resetDate: {
          type: Date,
          default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
      weeklyStakeAmount: {
        limit: { type: Number, default: 0 }, // 0 means no limit
        currentAmount: { type: Number, default: 0 },
        resetDate: {
          type: Date,
          default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
    },
    // ------------------------------------
  },
  { timestamps: true }
);

// Indexes for username, email, googleId, and facebookId are automatically
// created because the `unique` constraint is set to true.

userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("User", userSchema);
// This code defines a Mongoose schema for a User model in a Node.js application.
