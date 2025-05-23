const User = require("../models/User");
const Bet = require("../models/Bet");
const Game = require("../models/Game");
const Transaction = require("../models/Transaction");

// Existing stats route
const getStats = async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const betCount = await Bet.countDocuments();
    const gameCount = await Game.countDocuments();

    res.status(200).json({
      users: userCount,
      bets: betCount,
      games: gameCount,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// New dashboard route (totals of topups, bets, wins)
const getDashboard = async (req, res) => {
  try {
    const [topups, bets, wins] = await Promise.all([
      Transaction.aggregate([
        { $match: { type: "topup" } },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: { type: "bet" } },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: { type: "win" } },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    res.status(200).json({
      topups: {
        total: topups[0]?.total || 0,
        count: topups[0]?.count || 0,
      },
      bets: {
        total: -(bets[0]?.total || 0), // Negative for net cash flow
        count: bets[0]?.count || 0,
      },
      wins: {
        total: wins[0]?.total || 0,
        count: wins[0]?.count || 0,
      },
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = {
  getStats,
  getDashboard,
};
