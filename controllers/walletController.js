const { body, query, validationResult } = require("express-validator");
const mongoose = require("mongoose"); // For ObjectId in aggregation
const User = require("../models/User");
const Transaction = require("../models/Transaction");

// --- Validation Rules ---
exports.validateTopUpWallet = [
  body("amount")
    .isFloat({ gt: 0, lt: 100000 })
    .withMessage("Top-up amount must be a positive number less than 100,000.")
    .toFloat(), // Example max limit
];

exports.validateGetTransactionHistory = [
  query("type")
    .optional()
    .isIn(["bet", "win", "topup", "refund"])
    .withMessage("Invalid transaction type."),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be an integer between 1 and 100.")
    .toInt(),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer.")
    .toInt(),
];

// Get current user's wallet balance
exports.getWallet = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .select("walletBalance username email")
      .lean(); // Use lean for read-only

    if (!user) {
      const err = new Error("User wallet data not found.");
      err.statusCode = 404;
      return next(err);
    }
    res.json({
      username: user.username,
      email: user.email,
      walletBalance: parseFloat(user.walletBalance.toFixed(2)), // Ensure formatted output
    });
  } catch (error) {
    next(error);
  }
};

// Top up current user's wallet
exports.topUpWallet = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { amount } = req.body; // Amount is already validated and converted to float by express-validator

  try {
    const user = await User.findById(req.user.id); // Need full document to save
    if (!user) {
      const err = new Error("User not found for wallet top-up.");
      err.statusCode = 404;
      return next(err);
    }

    user.walletBalance += amount;
    user.walletBalance = parseFloat(user.walletBalance.toFixed(2)); // Ensure precision

    await user.save();

    const transaction = new Transaction({
      user: user._id,
      type: "topup",
      amount: parseFloat(amount.toFixed(2)), // Store validated amount with precision
      balanceAfter: user.walletBalance,
      description: `Wallet top-up of ${amount.toFixed(2)}`,
    });
    await transaction.save();

    res.status(200).json({
      msg: "Wallet topped up successfully.",
      walletBalance: user.walletBalance,
      transactionId: transaction._id,
    });
  } catch (error) {
    next(error);
  }
};

// Get transaction history for the current user
exports.getTransactionHistory = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { type } = req.query;
    const limit = req.query.limit || 10; // Defaults if not provided, already validated
    const page = req.query.page || 1;
    const skip = (page - 1) * limit;

    const filter = { user: req.user.id };
    if (type) {
      filter.type = type;
    }

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .populate({ path: "game", select: "homeTeam awayTeam" })
      .populate({ path: "bet", select: "outcome stake" })
      .limit(limit)
      .skip(skip)
      .lean();

    const totalTransactions = await Transaction.countDocuments(filter);

    res.json({
      transactions,
      currentPage: page,
      totalPages: Math.ceil(totalTransactions / limit),
      totalCount: totalTransactions,
    });
  } catch (error) {
    next(error);
  }
};

// Get wallet summary for the current user
exports.getWalletSummary = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const summaryPipeline = [
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId), // Ensure userId is ObjectId
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
      totalBetsPlaced: { amount: 0, count: 0 },
      totalWinnings: { amount: 0, count: 0 },
      totalRefunds: { amount: 0, count: 0 },
      netGamblingResult: 0,
      currentWalletBalance: 0,
    };

    results.forEach((item) => {
      const amount = parseFloat((item.totalAmount || 0).toFixed(2));
      const count = item.count || 0;
      if (item._id === "topup") {
        summary.totalTopUps = { amount, count };
      } else if (item._id === "bet") {
        summary.totalBetsPlaced = { amount: Math.abs(amount), count }; // Bets are negative
      } else if (item._id === "win") {
        summary.totalWinnings = { amount, count };
      } else if (item._id === "refund") {
        summary.totalRefunds = { amount, count };
      }
    });

    summary.netGamblingResult = parseFloat(
      (summary.totalWinnings.amount - summary.totalBetsPlaced.amount).toFixed(2)
    );

    const user = await User.findById(userId).select("walletBalance").lean();
    summary.currentWalletBalance = user
      ? parseFloat(user.walletBalance.toFixed(2))
      : 0;

    res.json(summary);
  } catch (error) {
    next(error);
  }
};
