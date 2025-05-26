const mongoose = require("mongoose");

// Sub-schema for odds to keep it organized
const oddsSchema = new mongoose.Schema(
  {
    home: {
      type: Number,
      required: [true, "Home odd is required"],
      min: [1, "Odds must be at least 1"],
    },
    away: {
      type: Number,
      required: [true, "Away odd is required"],
      min: [1, "Odds must be at least 1"],
    },
    draw: {
      type: Number,
      required: [true, "Draw odd is required"],
      min: [1, "Odds must be at least 1"],
    },
  },
  { _id: false } // Prevents Mongoose from creating an _id for this subdocument
);

const gameSchema = new mongoose.Schema(
  {
    homeTeam: {
      type: String,
      required: [true, "Home team is required"],
      trim: true,
    },
    awayTeam: {
      type: String,
      required: [true, "Away team is required"],
      trim: true,
    },
    odds: {
      type: oddsSchema, // Embed the odds sub-schema
      required: [true, "Odds are required"],
    },
    result: {
      type: String,
      enum: ["A", "B", "Draw", null], // A for home win, B for away win, Draw, or null if not set
      default: null, // Default result is null (pending)
    },
    league: {
      type: String,
      required: [true, "League is required"],
      trim: true,
    },
    matchDate: {
      type: Date,
      required: [true, "Match date is required"],
    },
    status: {
      type: String,
      enum: ["upcoming", "live", "finished", "cancelled"],
      default: "upcoming",
    },
  },
  { timestamps: true } // Automatically adds createdAt and updatedAt fields
);

// Ensure that a game cannot have the same home and away team
gameSchema.pre("save", function (next) {
  if (
    this.homeTeam &&
    this.awayTeam &&
    this.homeTeam.toLowerCase() === this.awayTeam.toLowerCase()
  ) {
    next(new Error("Home team and away team cannot be the same."));
  } else {
    next();
  }
});

// Index for faster querying of upcoming games
gameSchema.index({ matchDate: 1, status: 1 });

module.exports = mongoose.model("Game", gameSchema);
