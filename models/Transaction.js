const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the User model
      required: true,
    },
    type: {
      type: String,
      enum: ["bet", "win", "topup", "refund"], // Types of transactions
      required: [true, "Transaction type is required"],
    },
    amount: {
      // Amount of the transaction. Can be positive (topup, win, refund) or negative (bet)
      type: Number,
      required: [true, "Transaction amount is required"],
    },
    balanceAfter: {
      // User's wallet balance after this transaction
      type: Number,
      required: [true, "Balance after transaction is required"],
    },
    bet: {
      // Optional: reference to the bet if transaction type is 'bet', 'win', or 'refund' for a bet
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bet",
      default: null,
    },
    game: {
      // Optional: reference to the game related to this transaction (especially for bets/wins)
      type: mongoose.Schema.Types.ObjectId,
      ref: "Game",
      default: null,
    },
    description: {
      // Optional: a brief description of the transaction
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true } // Automatically adds createdAt and updatedAt fields
);

// Index for querying transactions by user
transactionSchema.index({ user: 1, type: 1 });
transactionSchema.index({ user: 1, createdAt: -1 }); // For fetching user's transaction history

module.exports = mongoose.model("Transaction", transactionSchema);
// This schema defines a transaction model for a betting application.