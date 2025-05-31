const User = require("../models/User");
const Bet = require("../models/Bet");
const Game = require("../models/Game");
const Transaction = require("../models/Transaction");
const { query, validationResult } = require("express-validator"); // For input validation

// Admin: Get basic platform statistics
exports.getPlatformStats = async (req, res, next) => {
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
    // console.error("Error fetching platform stats:", err.message); // Handled by global error handler
    next(err); // Pass error to centralized error handler
  }
};

// Admin: Get financial dashboard
exports.getFinancialDashboard = async (req, res, next) => {
  try {
    const financialData = await Transaction.aggregate([
      {
        $match: {
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
    ]);

    const dashboardStats = {
      totalTopUps: { amount: 0, count: 0 },
      totalStakes: { amount: 0, count: 0 },
      totalPayoutsToUsers: { amount: 0, count: 0 },
      totalRefunds: { amount: 0, count: 0 },
      platformRevenue: { amount: 0 },
    };

    financialData.forEach((transactionType) => {
      if (transactionType._id === "topup") {
        dashboardStats.totalTopUps = {
          amount: transactionType.totalAmount || 0,
          count: transactionType.count || 0,
        };
      } else if (transactionType._id === "bet") {
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

    dashboardStats.platformRevenue.amount =
      dashboardStats.totalStakes.amount -
      dashboardStats.totalPayoutsToUsers.amount -
      dashboardStats.totalRefunds.amount;

    for (const key in dashboardStats) {
      if (dashboardStats[key].hasOwnProperty("amount")) {
        dashboardStats[key].amount = parseFloat(
          dashboardStats[key].amount.toFixed(2)
        );
      }
    }

    res.status(200).json(dashboardStats);
  } catch (err) {
    // console.error("Error fetching financial dashboard:", err.message); // Handled by global error handler
    next(err);
  }
};

// Validation rules for listUsers
exports.validateListUsers = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer."),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be an integer between 1 and 100."),
  query("role")
    .optional()
    .isIn(["user", "admin"])
    .withMessage('Role must be either "user" or "admin".'),
  query("sortBy")
    .optional()
    .isString()
    .trim()
    .escape()
    .withMessage("SortBy must be a string."), // Further validation could check against allowed fields
  query("order")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage('Order must be "asc" or "desc".'),
  query("search")
    .optional()
    .isString()
    .trim()
    .escape()
    .withMessage("Search term must be a string."),
];

// Admin: List users (with pagination)
exports.listUsers = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      page = 1,
      limit = 10,
      role,
      sortBy = "createdAt", // Default sort field
      order = "desc", // Default sort order
      search,
    } = req.query;

    // Parsed and validated values
    const queryPage = parseInt(page);
    const queryLimit = parseInt(limit);
    const skip = (queryPage - 1) * queryLimit;

    const filter = {};
    if (role) filter.role = role;
    if (search) {
      const searchRegex = new RegExp(search, "i"); // Case-insensitive search
      filter.$or = [
        { username: searchRegex },
        { email: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
      ];
    }

    // Basic protection against NoSQL injection for sortBy by ensuring it's a reasonable field name (alphanumeric)
    // A more robust solution would be to whitelist allowed sortBy fields.
    const safeSortBy = /^[a-zA-Z0-9_]+$/.test(sortBy) ? sortBy : "createdAt";

    const sortOptions = {};
    sortOptions[safeSortBy] = order === "asc" ? 1 : -1;

    const users = await User.find(filter)
      .select("-password") // Exclude passwords
      .sort(sortOptions)
      .limit(queryLimit)
      .skip(skip)
      .lean(); // Use .lean() for faster queries when not modifying documents

    const totalUsers = await User.countDocuments(filter);

    res.json({
      users,
      currentPage: queryPage,
      totalPages: Math.ceil(totalUsers / queryLimit),
      totalCount: totalUsers,
    });
  } catch (err) {
    // console.error("Error listing users:", err.message); // Handled by global error handler
    next(err);
  }
};

// Admin: Get all users with full details for specific needs
exports.getAllUsersFullDetails = async (req, res, next) => {
  try {
    // Consider adding pagination here as well if the number of users can be very large.
    // For now, fetching all as per original function's intent.
    const allUsers = await User.find({}).lean(); // Use .lean() for performance

    const formattedUsers = allUsers.map((userObject) => {
      // userObject is already a plain object due to .lean()
      // 'verified' field is not in the current User.js model.
      // If you add it to the model, it would be: verified: userObject.verified,
      return {
        _id: userObject._id,
        role: userObject.role,
        user: userObject.username, // Mapping 'username' to 'user'
        email: userObject.email,
        password: userObject.password, // Hashed password
        firstName: userObject.firstName,
        lastName: userObject.lastName,
        state: userObject.state,
        createdAt: userObject.createdAt,
        updatedAt: userObject.updatedAt,
        __v: userObject.__v,
      };
    });

    res.status(200).json({
      msg: "Successfully fetched all user details.", // More descriptive message
      allUser: formattedUsers,
    });
  } catch (err) {
    // console.error("Error fetching all users full details:", err.message); // Handled by global error handler
    next(err);
  }
};
