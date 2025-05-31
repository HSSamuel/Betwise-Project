const { body, query, param, validationResult } = require("express-validator");
const mongoose = require("mongoose");
const Game = require("../models/Game");
const Bet = require("../models/Bet");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { resolveBets } = require("./betController");

// --- Validation Rules ---

exports.validateCreateGame = [
  body("homeTeam")
    .trim()
    .notEmpty()
    .withMessage("Home team is required.")
    .isLength({ min: 2, max: 100 })
    .withMessage("Home team must be between 2 and 100 characters.")
    .escape(),
  body("awayTeam")
    .trim()
    .notEmpty()
    .withMessage("Away team is required.")
    .isLength({ min: 2, max: 100 })
    .withMessage("Away team must be between 2 and 100 characters.")
    .escape()
    .custom((value, { req }) => {
      if (value.toLowerCase() === req.body.homeTeam.toLowerCase()) {
        throw new Error("Home team and away team cannot be the same.");
      }
      return true;
    }),
  body("odds").isObject().withMessage("Odds object is required."),
  body("odds.home")
    .isFloat({ gt: 0 })
    .withMessage("Home odd must be a positive number.")
    .toFloat(),
  body("odds.away")
    .isFloat({ gt: 0 })
    .withMessage("Away odd must be a positive number.")
    .toFloat(),
  body("odds.draw")
    .isFloat({ gt: 0 })
    .withMessage("Draw odd must be a positive number.")
    .toFloat(),
  body("league")
    .trim()
    .notEmpty()
    .withMessage("League is required.")
    .isLength({ min: 2, max: 100 })
    .escape(),
  body("matchDate")
    .isISO8601()
    .toDate()
    .withMessage("Valid match date is required.")
    .custom((value) => {
      if (value.getTime() < Date.now()) {
        throw new Error("Match date cannot be in the past.");
      }
      return true;
    }),
  body("status")
    .optional()
    .isIn(["upcoming", "live", "finished", "cancelled"])
    .withMessage("Invalid status."),
];

exports.validateGetGames = [
  query("league").optional().isString().trim().escape(),
  query("status")
    .optional()
    .isIn(["upcoming", "live", "finished", "cancelled"])
    .escape(),
  query("date")
    .optional()
    .isISO8601()
    .toDate()
    .withMessage("Invalid date format for query."),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer.")
    .toInt(),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be an integer between 1 and 100.")
    .toInt(),
];

exports.validateGameId = [
  param("id").isMongoId().withMessage("Invalid game ID format."),
];

exports.validateSetResult = [
  param("id").isMongoId().withMessage("Invalid game ID format."),
  body("result")
    .isIn(["A", "B", "Draw"])
    .withMessage("Result must be 'A', 'B', or 'Draw'."),
];

exports.validateUpdateGame = [
  param("id").isMongoId().withMessage("Invalid game ID format."),
  // Body for update is flexible, so we validate common fields if they exist
  body("homeTeam").optional().trim().isLength({ min: 2, max: 100 }).escape(),
  body("awayTeam")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .escape()
    .custom((value, { req }) => {
      if (
        req.body.homeTeam &&
        value &&
        value.toLowerCase() === req.body.homeTeam.toLowerCase()
      ) {
        throw new Error(
          "Home team and away team cannot be the same if both are being updated."
        );
      }
      return true;
    }),
  body("odds").optional().isObject(),
  body("odds.home").optional().isFloat({ gt: 0 }).toFloat(),
  body("odds.away").optional().isFloat({ gt: 0 }).toFloat(),
  body("odds.draw").optional().isFloat({ gt: 0 }).toFloat(),
  body("league").optional().trim().isLength({ min: 2, max: 100 }).escape(),
  body("matchDate").optional().isISO8601().toDate(),
  body("status").optional().isIn(["upcoming", "live", "finished", "cancelled"]),
];

// Admin: Create a new game
exports.createGame = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { homeTeam, awayTeam, odds, league, matchDate, status } = req.body;

  try {
    // Check for existing game with same teams on the same day (ignoring time)
    const searchDate = new Date(matchDate);
    const startOfDay = new Date(
      searchDate.getFullYear(),
      searchDate.getMonth(),
      searchDate.getDate()
    );
    const endOfDay = new Date(
      searchDate.getFullYear(),
      searchDate.getMonth(),
      searchDate.getDate() + 1
    );

    const existingGame = await Game.findOne({
      homeTeam: { $regex: new RegExp(`^${homeTeam}$`, "i") }, // Case-insensitive check
      awayTeam: { $regex: new RegExp(`^${awayTeam}$`, "i") }, // Case-insensitive check
      matchDate: { $gte: startOfDay, $lt: endOfDay },
    });

    if (existingGame) {
      const err = new Error(
        "A game with these teams on this date already exists."
      );
      err.statusCode = 400;
      return next(err);
    }

    const game = new Game({
      homeTeam,
      awayTeam,
      odds,
      league,
      matchDate, // Already validated and converted to Date by express-validator
      status: status || "upcoming",
    });

    await game.save();

    res.status(201).json({
      message: `Match added: ${game.homeTeam} vs ${game.awayTeam} on ${new Date(
        game.matchDate
      ).toLocaleDateString()}.`,
      game,
    });
  } catch (error) {
    next(error);
  }
};

// Public: Get all games
exports.getGames = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { league, status, date } = req.query;
    const page = req.query.page || 1; // Defaults handled by validator if not present
    const limit = req.query.limit || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (league) filter.league = { $regex: new RegExp(league, "i") }; // Case-insensitive
    if (status) filter.status = status;
    if (date) {
      // date is already a Date object from validator
      const startDate = new Date(date.setHours(0, 0, 0, 0));
      const endDate = new Date(date.setHours(23, 59, 59, 999));
      filter.matchDate = { $gte: startDate, $lte: endDate };
    }

    const games = await Game.find(filter)
      .sort({ matchDate: 1 })
      .limit(limit)
      .skip(skip)
      .lean();
    const totalGames = await Game.countDocuments(filter);

    res.json({
      games,
      currentPage: page,
      totalPages: Math.ceil(totalGames / limit),
      totalCount: totalGames,
    });
  } catch (error) {
    next(error);
  }
};

// Public: Get a single game by ID
exports.getGameById = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Checks for MongoId format from param
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const game = await Game.findById(req.params.id).lean();
    if (!game) {
      const err = new Error("Game not found.");
      err.statusCode = 404;
      return next(err);
    }
    res.json(game);
  } catch (error) {
    next(error);
  }
};

// Admin: Set the result for a game and process payouts
exports.setResult = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { result } = req.body;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const game = await Game.findById(id).session(session);
    if (!game) {
      await session.abortTransaction();
      session.endSession();
      const err = new Error("Game not found.");
      err.statusCode = 404;
      return next(err);
    }

    if (game.status === "cancelled") {
      await session.abortTransaction();
      session.endSession();
      const err = new Error("Cannot set result for a cancelled game.");
      err.statusCode = 400;
      return next(err);
    }
    if (game.result) {
      await session.abortTransaction();
      session.endSession();
      const err = new Error(
        `Game result already set to ${game.result}. Cannot change.`
      );
      err.statusCode = 400;
      return next(err);
    }
    if (game.status !== "live" && game.status !== "upcoming") {
      // Allow setting result for upcoming games if admin wants to finalize early,
      // or live games. Finished games already have results.
      await session.abortTransaction();
      session.endSession();
      const err = new Error(
        `Game status is '${game.status}'. Result can only be set for 'upcoming' or 'live' games.`
      );
      err.statusCode = 400;
      return next(err);
    }

    game.result = result;
    game.status = "finished";
    await game.save({ session });

    await resolveBets(game, session);

    await session.commitTransaction();
    session.endSession();

    res.json({
      msg: `Result for game ${game.homeTeam} vs ${game.awayTeam} set to '${result}'. Bets resolved.`,
      game,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

// Admin: Update game details
exports.updateGame = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const updates = req.body;

  try {
    const game = await Game.findById(id);
    if (!game) {
      const err = new Error("Game not found.");
      err.statusCode = 404;
      return next(err);
    }

    // --- Business logic for update restrictions ---
    if (game.status === "finished" || game.status === "cancelled") {
      const err = new Error(
        `Cannot update game details because its status is '${game.status}'.`
      );
      err.statusCode = 400;
      return next(err);
    }

    // Prevent matchDate from being set to the past if the game is 'upcoming' and date is being changed
    if (
      updates.matchDate &&
      game.status === "upcoming" &&
      new Date(updates.matchDate) < new Date()
    ) {
      const err = new Error(
        "Match date for an upcoming game cannot be updated to the past."
      );
      err.statusCode = 400;
      return next(err);
    }

    // More restrictive updates if the game is 'live'
    if (game.status === "live") {
      const allowedLiveUpdates = ["status", "league", "matchDate"]; // Example: only these fields can be updated for a live game
      // Odds and teams typically should not change once live.
      // If status is changed to 'cancelled', specific logic applies.
      for (const key in updates) {
        if (!allowedLiveUpdates.includes(key)) {
          const err = new Error(
            `Cannot update field '${key}' for a live game. Allowed fields are: ${allowedLiveUpdates.join(
              ", "
            )}.`
          );
          err.statusCode = 400;
          return next(err);
        }
      }
      if (
        updates.status &&
        updates.status !== "cancelled" &&
        updates.status !== "live"
      ) {
        const err = new Error(
          "For live games, status can only be updated to 'cancelled' (use cancel endpoint) or remain 'live'. Use set result for 'finished'."
        );
        err.statusCode = 400;
        return next(err);
      }
    }

    // Prevent changing team names or critical odds once bets might exist for non-upcoming games
    const criticalFieldsChanged =
      updates.homeTeam ||
      updates.awayTeam ||
      (updates.odds &&
        (updates.odds.home || updates.odds.away || updates.odds.draw));
    if (game.status !== "upcoming" && criticalFieldsChanged) {
      const betCount = await Bet.countDocuments({
        game: game._id,
        status: "pending",
      }); // Check pending bets
      if (betCount > 0) {
        const err = new Error(
          "Cannot change team names or odds for a game that is not 'upcoming' and has pending bets. Cancel and recreate if needed."
        );
        err.statusCode = 400;
        return next(err);
      }
    }
    // --- End Business logic for update restrictions ---

    // Apply updates
    Object.keys(updates).forEach((key) => {
      if (key === "odds" && typeof updates.odds === "object" && game.odds) {
        // Ensure game.odds exists
        game.odds = { ...game.odds, ...updates.odds };
      } else if (key !== "_id" && updates[key] !== undefined) {
        game[key] = updates[key];
      }
    });

    // If homeTeam or awayTeam is updated, ensure they are not the same
    if (
      (updates.homeTeam || updates.awayTeam) &&
      game.homeTeam.toLowerCase() === game.awayTeam.toLowerCase()
    ) {
      const err = new Error("Home team and away team cannot be the same.");
      err.statusCode = 400;
      return next(err); // Or handle within express-validator if both are always present in update
    }

    await game.save();
    res.json({ msg: "Game updated successfully.", game });
  } catch (error) {
    next(error);
  }
};

// Admin: Cancel a game
exports.cancelGame = async (req, res, next) => {
  const errors = validationResult(req); // For param('id') validation
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const game = await Game.findById(id).session(session);
    if (!game) {
      await session.abortTransaction();
      session.endSession();
      const err = new Error("Game not found.");
      err.statusCode = 404;
      return next(err);
    }

    if (game.status === "finished" && game.result) {
      await session.abortTransaction();
      session.endSession();
      const err = new Error(
        "Cannot cancel a game that has already finished and has a result."
      );
      err.statusCode = 400;
      return next(err);
    }
    if (game.status === "cancelled") {
      await session.abortTransaction();
      session.endSession();
      const err = new Error("Game is already cancelled.");
      err.statusCode = 400;
      return next(err);
    }

    game.status = "cancelled";
    game.result = null;
    await game.save({ session });

    const betsToRefund = await Bet.find({
      game: game._id,
      status: "pending", // Only refund pending bets
    })
      .populate("user")
      .session(session);

    for (const bet of betsToRefund) {
      if (bet.user) {
        bet.user.walletBalance += bet.stake;
        bet.user.walletBalance = parseFloat(bet.user.walletBalance.toFixed(2));
        await bet.user.save({ session });

        await new Transaction({
          user: bet.user._id,
          type: "refund",
          amount: bet.stake,
          balanceAfter: bet.user.walletBalance,
          bet: bet._id,
          game: game._id,
          description: `Refund for cancelled game: ${game.homeTeam} vs ${game.awayTeam}`,
        }).save({ session });
      }
      bet.status = "cancelled"; // Update bet status
      await bet.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    res.json({
      msg: `Game ${game.homeTeam} vs ${game.awayTeam} cancelled. ${betsToRefund.length} pending bets refunded.`,
      game,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};
