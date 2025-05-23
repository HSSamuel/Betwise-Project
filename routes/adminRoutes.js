const express = require("express");
const router = express.Router();
const { auth, isAdmin } = require("../middleware/authMiddleware");
const { getStats } = require("../controllers/adminController");
const Transaction = require("../models/Transaction");

// Dashboard route
router.get("/dashboard", auth, isAdmin, async (req, res) => {
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

    res.json({
      topups: {
        total: topups[0]?.total || 0,
        count: topups[0]?.count || 0,
      },
      bets: {
        total: -(bets[0]?.total || 0),
        count: bets[0]?.count || 0,
      },
      wins: {
        total: wins[0]?.total || 0,
        count: wins[0]?.count || 0,
      },
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// Admin only stats route
router.get("/stats", auth, isAdmin, getStats);

module.exports = router;
// This code sets up an Express router for admin-related routes. It includes a dashboard route that aggregates transaction data (topups, bets, wins) and returns it in JSON format. The stats route is protected by authentication and admin middleware, ensuring that only authorized users can access it. The router is then exported for use in the main application.
