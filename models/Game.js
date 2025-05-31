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

const gameSchema = new mongoose.Schema(
  {
    homeTeam: {
      type: String,
      required: [true, "Home team name is required."],
      trim: true,
      // Example: Add minlength/maxlength if desired
      // minlength: [2, "Home team name must be at least 2 characters long."],
      // maxlength: [100, "Home team name cannot exceed 100 characters."]
    },
    awayTeam: {
      type: String,
      required: [true, "Away team name is required."],
      trim: true,
      // minlength: [2, "Away team name must be at least 2 characters long."],
      // maxlength: [100, "Away team name cannot exceed 100 characters."]
    },
    odds: {
      type: oddsSchema,
      required: [true, "Odds (home, away, draw) are required."],
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
      // minlength: [2, "League name must be at least 2 characters long."],
      // maxlength: [100, "League name cannot exceed 100 characters."]
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
  },
  { timestamps: true }
);

// Ensure that a game cannot have the same home and away team (case-insensitive)
gameSchema.pre("save", function (next) {
  if (
    this.homeTeam &&
    this.awayTeam &&
    this.homeTeam.trim().toLowerCase() === this.awayTeam.trim().toLowerCase()
  ) {
    // Using trim() here as well to be safe, though schema has trim:true
    next(new Error("Home team and away team cannot be the same."));
  } else {
    next();
  }
});

// Index for faster querying of games by date and status
gameSchema.index({ matchDate: 1, status: 1 });
// Consider adding other indexes based on frequent query patterns, e.g.:
// gameSchema.index({ league: 1, status: 1 });
// gameSchema.index({ league: 1, matchDate: 1 });

module.exports = mongoose.model("Game", gameSchema);
