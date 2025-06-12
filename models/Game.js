const mongoose = require("mongoose");

// Sub-schema for odds to keep it organized
const oddsSchema = new mongoose.Schema(
  {
    home: {
      type: Number,
      required: [true, "Home odd is required."],
      min: [1, "Odds must be at least 1."],
    },
    away: {
      type: Number,
      required: [true, "Away odd is required."],
      min: [1, "Odds must be at least 1."],
    },
    draw: {
      type: Number,
      required: [true, "Draw odd is required."],
      min: [1, "Odds must be at least 1."],
    },
  },
  { _id: false }
);

// --- SUB-SCHEMA for Historical Odds ---
const oddsHistorySchema = new mongoose.Schema({
  odds: {
    type: oddsSchema,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const gameSchema = new mongoose.Schema(
  {
    homeTeam: {
      type: String,
      required: [true, "Home team name is required."],
      trim: true,
    },
    homeTeamLogo: {
      type: String,
      trim: true,
    },
    awayTeam: {
      type: String,
      required: [true, "Away team name is required."],
      trim: true,
    },
    awayTeamLogo: {
      type: String,
      trim: true,
    },
    odds: {
      type: oddsSchema,
      required: [true, "Odds (home, away, draw) are required."],
    },
    oddsHistory: {
      type: [oddsHistorySchema],
      default: [],
    },
    result: {
      type: String,
      enum: {
        values: ["A", "B", "Draw", null],
        message:
          'Game result "{VALUE}" is not supported. Must be "A", "B", "Draw", or null.',
      },
      default: null,
    },
    league: {
      type: String,
      required: [true, "League name is required."],
      trim: true,
    },
    matchDate: {
      type: Date,
      required: [true, "Match date and time are required."],
    },
    status: {
      type: String,
      enum: {
        values: ["upcoming", "live", "finished", "cancelled"],
        message:
          'Game status "{VALUE}" is not supported. Must be upcoming, live, finished, or cancelled.',
      },
      default: "upcoming",
    },
    summary: {
      type: String,
      trim: true,
      default: "",
    },
    externalApiId: {
      type: String,
      unique: true, // This automatically creates the index we need
      sparse: true,
    },
  },
  { timestamps: true }
);

gameSchema.pre("save", function (next) {
  if (
    this.homeTeam &&
    this.awayTeam &&
    this.homeTeam.trim().toLowerCase() === this.awayTeam.trim().toLowerCase()
  ) {
    next(new Error("Home team and away team cannot be the same."));
  } else {
    next();
  }
});

// Index for faster querying of games by date and status
gameSchema.index({ matchDate: 1, status: 1 });

// REMOVED this redundant line:
// gameSchema.index({ externalApiId: 1 });

module.exports = mongoose.model("Game", gameSchema);
