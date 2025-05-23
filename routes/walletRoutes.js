const express = require("express");
const router = express.Router();

const { auth } = require("../middleware/authMiddleware"); // Adjust path if needed
const walletController = require("../controllers/walletController");
const Transaction = require("../models/Transaction");

// Get user's wallet info
router.get("/", auth, walletController.getWallet);

// Top up wallet
router.post("/topup", auth, walletController.topUpWallet);

// Get user's transactions, sorted by newest first
router.get("/transactions", auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id }).sort({
      createdAt: -1,
    });
    res.json(transactions);
  } catch (err) {
    console.error("Error fetching transactions:", err);
    res.status(500).json({ msg: "Server error" });
  }
});
// Get wallet summary: total topups, bets, and wins
router.get("/summary", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [topups, bets, wins] = await Promise.all([
      Transaction.aggregate([
        { $match: { user: req.user._id, type: "topup" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Transaction.aggregate([
        { $match: { user: req.user._id, type: "bet" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Transaction.aggregate([
        { $match: { user: req.user._id, type: "win" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    res.json({
      totalTopups: topups[0]?.total || 0,
      totalBets: -(bets[0]?.total || 0), // bets are negative
      totalWins: wins[0]?.total || 0,
    });
  } catch (err) {
    console.error("Error generating summary:", err);
    res.status(500).json({ msg: "Server error" });
  }
});
module.exports = router;
// This code sets up a router for wallet-related routes in an Express application. It imports the necessary modules and middleware, defines two routes for getting wallet information and topping up the wallet, and exports the router for use in the main application. The routes are protected by authentication middleware to ensure that only authenticated users can access them.
