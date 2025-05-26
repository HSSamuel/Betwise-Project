const User = require("../models/User");
const Bet = require("../models/Bet");
const Game = require("../models/Game");
const Transaction = require("../models/Transaction");

// Admin: Get basic platform statistics
exports.getPlatformStats = async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const betCount = await Bet.countDocuments();
    const gameCount = await Game.countDocuments({
      status: { $ne: "cancelled" },
    }); // Active games
    const pendingGames = await Game.countDocuments({ status: "upcoming" });
    const totalTransactions = await Transaction.countDocuments();

    res.status(200).json({
      totalUsers: userCount,
      totalBets: betCount,
      totalGames: gameCount,
      upcomingGames: pendingGames,
      totalTransactionsRecorded: totalTransactions,
    });
  } catch (err) {
    console.error("Error fetching platform stats:", err.message);
    res
      .status(500)
      .json({ msg: "Server error while fetching platform stats." });
  }
};

// Admin: Get financial dashboard (totals of topups, bets, wins)
exports.getFinancialDashboard = async (req, res) => {
  try {
    // Perform a single aggregation to handle multiple transaction types
    const financialData = await Transaction.aggregate([
      {
        $match: {
          type: { $in: ["topup", "bet", "win", "refund"] }, // Match relevant transaction types
        },
      },
      {
        $group: {
          _id: "$type", // Group by transaction type
          totalAmount: { $sum: "$amount" }, // Sum of amounts for each type
          count: { $sum: 1 }, // Count of transactions for each type
        },
      },
    ]);

    // Initialize stats object with defaults
    const dashboardStats = {
      totalTopUps: { amount: 0, count: 0 },
      totalStakes: { amount: 0, count: 0 }, // Sum of all money staked (positive value)
      totalPayoutsToUsers: { amount: 0, count: 0 }, // Sum of all winnings paid out
      totalRefunds: { amount: 0, count: 0 },
      platformRevenue: { amount: 0 }, // (Total Stakes - Total Payouts to Users - Total Refunds on bets)
    };

    let rawTotalStakes = 0;

    // Map the aggregated results to the dashboardStats object
    financialData.forEach((transactionType) => {
      if (transactionType._id === "topup") {
        dashboardStats.totalTopUps = {
          amount: transactionType.totalAmount || 0,
          count: transactionType.count || 0,
        };
      } else if (transactionType._id === "bet") {
        // 'amount' for bets is stored as negative. For total stakes, we want the positive sum.
        rawTotalStakes = transactionType.totalAmount || 0; // This will be negative or zero
        dashboardStats.totalStakes = {
          amount: Math.abs(transactionType.totalAmount) || 0,
          count: transactionType.count || 0,
        };
      } else if (transactionType._id === "win") {
        dashboardStats.totalPayoutsToUsers = {
          amount: transactionType.totalAmount || 0,
          count: transactionType.count || 0,
        };
      } else if (transactionType._id === "refund") {
        dashboardStats.totalRefunds = {
          amount: transactionType.totalAmount || 0,
          count: transactionType.count || 0,
        };
      }
    });

    // Calculate platform revenue
    // Revenue = (Total money staked by users) - (Total money paid out as winnings) - (Total money refunded on bets)
    // Note: totalRefunds might include non-bet refunds if that logic is added later.
    // For now, assuming refunds are primarily for cancelled bets.
    dashboardStats.platformRevenue.amount =
      dashboardStats.totalStakes.amount -
      dashboardStats.totalPayoutsToUsers.amount -
      dashboardStats.totalRefunds.amount;
    // Ensure amounts are fixed to 2 decimal places
    for (const key in dashboardStats) {
      if (dashboardStats[key].hasOwnProperty("amount")) {
        dashboardStats[key].amount = parseFloat(
          dashboardStats[key].amount.toFixed(2)
        );
      }
    }

    res.status(200).json(dashboardStats);
  } catch (err) {
    console.error("Error fetching financial dashboard:", err.message);
    res
      .status(500)
      .json({ msg: "Server error while fetching financial dashboard." });
  }
};

// Admin: List users (with pagination)
exports.listUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;
    const queryLimit = parseInt(limit);
    const skip = (parseInt(page) - 1) * queryLimit;

    const filter = {};
    if (role) filter.role = role;

    const sortOptions = {};
    sortOptions[sortBy] = order === "asc" ? 1 : -1;

    const users = await User.find(filter)
      .select("-password") // Exclude passwords
      .sort(sortOptions)
      .limit(queryLimit)
      .skip(skip);

    const totalUsers = await User.countDocuments(filter);

    res.json({
      users,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalUsers / queryLimit),
      totalCount: totalUsers,
    });
  } catch (err) {
    console.error("Error listing users:", err.message);
    res.status(500).json({ msg: "Server error while listing users." });
  }
};
// Admin: Get user details by ID (excluding password)
