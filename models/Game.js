const mongoose = require("mongoose");

const gameSchema = new mongoose.Schema(
  {
    homeTeam: {
      type: String,
      required: true,
    },
    awayTeam: {
      type: String,
      required: true,
    },
    odds: {
      home: { type: Number, required: true },
      away: { type: Number, required: true },
      draw: { type: Number, required: true },
    },
    result: {
      type: String,
      enum: ["A", "B", "Draw"],
      default: null,
    },
    league: {
      type: String,
      required: true,
    },
    matchDate: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Game", gameSchema);
