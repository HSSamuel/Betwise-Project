const User = require("../models/User");
const Transaction = require("../models/Transaction");

// Get current user's wallet balance
exports.getWallet = async (req, res) => {
  try {
    // req.user is attached by the auth middleware
    const user = await User.findById(req.user.id).select(
      "walletBalance username email"
    );
    if (!user) {
      // This case should ideally not happen if auth middleware is working correctly
      return res.status(404).json({ msg: "User not found." });
    }
    res.json({
      username: user.username,
      email: user.email,
      walletBalance: user.walletBalance,
    });
  } catch (err) {
    console.error("Error fetching wallet:", err.message);
    res
      .status(500)
      .json({ msg: "Server error while fetching wallet balance." });
  }
};

// Top up current user's wallet
exports.topUpWallet = async (req, res) => {
  try {
    const { amount } = req.body;
    const topUpAmount = Number(amount);

    // Validate top-up amount
    if (isNaN(topUpAmount) || topUpAmount <= 0) {
      return res
        .status(400)
        .json({ msg: "Invalid top-up amount. Must be a positive number." });
    }
    // Optional: Add a maximum top-up limit
    // if (topUpAmount > 10000) { // Example limit
    //   return res.status(400).json({ msg: "Top-up amount exceeds the maximum limit." });
    // }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: "User not found." }); // Should be rare
    }

    // Update wallet balance
    user.walletBalance += topUpAmount;
    await user.save();

    // Create a transaction record for the top-up
    const transaction = new Transaction({
      user: user._id,
      type: "topup",
      amount: topUpAmount,
      balanceAfter: user.walletBalance,
      description: `Wallet top-up of ${topUpAmount}`,
    });
    await transaction.save();

    res.status(200).json({
      msg: "Wallet topped up successfully.",
      walletBalance: user.walletBalance,
      transactionId: transaction._id,
    });
  } catch (err) {
    console.error("Error topping up wallet:", err.message);
    res.status(500).json({ msg: "Server error while topping up wallet." });
  }
};

// Get transaction history for the current user
exports.getTransactionHistory = async (req, res) => {
  try {
    const { type, limit = 10, page = 1 } = req.query; // Add pagination and type filtering
    const queryLimit = parseInt(limit);
    const skip = (parseInt(page) - 1) * queryLimit;

    const filter = { user: req.user.id };
    if (type && ["bet", "win", "topup", "refund"].includes(type)) {
      filter.type = type;
    }

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 }) // Newest first
      .populate({ path: "game", select: "homeTeam awayTeam" }) // Optionally populate game details
      .populate({ path: "bet", select: "outcome stake" }) // Optionally populate bet details
      .limit(queryLimit)
      .skip(skip);

    const totalTransactions = await Transaction.countDocuments(filter);

    if (!transactions || transactions.length === 0) {
      return res.status(404).json({ msg: "No transactions found." });
    }

    res.json({
      transactions,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalTransactions / queryLimit),
      totalCount: totalTransactions,
    });
  } catch (err) {
    console.error("Error fetching transaction history:", err.message);
    res
      .status(500)
      .json({ msg: "Server error while fetching transaction history." });
  }
};

// Get wallet summary for the current user
exports.getWalletSummary = async (req, res) => {
  try {
    const userId = req.user.id;

    // Using a single aggregation pipeline for efficiency
    const summaryPipeline = [
      {
        $match: {
          user: userId,
          type: { $in: ["topup", "bet", "win", "refund"] },
        },
      },
      {
        $group: {
          _id: "$type",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ];

    const results = await Transaction.aggregate(summaryPipeline);

    const summary = {
      totalTopUps: { amount: 0, count: 0 },
      totalBetsPlaced: { amount: 0, count: 0 }, // Sum of stakes (absolute value)
      totalWinnings: { amount: 0, count: 0 },
      totalRefunds: { amount: 0, count: 0 },
      netGamblingResult: 0, // totalWinnings - totalBetsPlaced (stakes)
    };

    results.forEach((item) => {
      if (item._id === "topup") {
        summary.totalTopUps = { amount: item.totalAmount, count: item.count };
      } else if (item._id === "bet") {
        // Bets are stored as negative, so sum of amounts will be negative.
        // For "total stakes", we want the sum of positive stake values.
        // This requires fetching original stakes or storing them positively.
        // Assuming 'amount' for 'bet' type is negative stake.
        summary.totalBetsPlaced = {
          amount: Math.abs(item.totalAmount),
          count: item.count,
        };
      } else if (item._id === "win") {
        summary.totalWinnings = { amount: item.totalAmount, count: item.count };
      } else if (item._id === "refund") {
        summary.totalRefunds = { amount: item.totalAmount, count: item.count };
      }
    });

    summary.netGamblingResult =
      summary.totalWinnings.amount - summary.totalBetsPlaced.amount;

    // Also get current balance
    const user = await User.findById(userId).select("walletBalance");
    summary.currentWalletBalance = user ? user.walletBalance : 0;

    res.json(summary);
  } catch (err) {
    console.error("Error generating wallet summary:", err.message);
    res
      .status(500)
      .json({ msg: "Server error while generating wallet summary." });
  }
};
// This controller handles wallet-related operations for users, including:
