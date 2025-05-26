const mongoose = require("mongoose");

const BetSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the User model
      required: true,
    },
    game: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Game", // Reference to the Game model
      required: true,
    },
    outcome: {
      // The user's predicted outcome
      type: String,
      enum: ["A", "B", "Draw"], // A for home team win, B for away team win
      required: [true, "Outcome is required"],
    },
    stake: {
      type: Number,
      required: [true, "Stake is required"],
      min: [0.01, "Stake must be a positive amount"], // Minimum stake amount
    },
    payout: {
      // Potential or actual payout
      type: Number,
      default: 0,
      min: [0, "Payout cannot be negative"],
    },
    status: {
      type: String,
      enum: ["pending", "won", "lost", "cancelled"], // Status of the bet
      default: "pending",
    },
  },
  { timestamps: true } // Automatically adds createdAt and updatedAt fields
);

// Index for querying bets by user and game
BetSchema.index({ user: 1, game: 1 });
BetSchema.index({ game: 1, status: 1 }); // For resolving bets efficiently

module.exports = mongoose.model("Bet", BetSchema);
