const { body, query, validationResult } = require("express-validator");
const mongoose = require("mongoose");
const Bet = require("../models/Bet");
const Game = require("../models/Game");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

// --- Validation Rules ---
exports.validatePlaceBet = [
  body("gameId").isMongoId().withMessage("Valid gameId is required."),
  body("outcome")
    .isIn(["A", "B", "Draw"])
    .withMessage("Outcome must be 'A', 'B', or 'Draw'."),
  body("stake")
    .isFloat({ gt: 0 })
    .withMessage("Stake must be a positive number.")
    .toFloat(),
];

exports.validateGetUserBets = [
  query("status")
    .optional()
    .isIn(["pending", "won", "lost", "cancelled"])
    .withMessage("Invalid bet status."),
  query("gameId").optional().isMongoId().withMessage("Invalid gameId format."),
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

// User: Place a new bet
exports.placeBet = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let { gameId, outcome, stake } = req.body; // stake is already a float due to validation
  const userId = req.user._id;

  if (!userId) {
    // Add a safety check
    return next(
      new Error("Could not identify user from authentication token.")
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(userId).session(session);
    if (!user) {
      // This should ideally not happen if auth middleware is correct and user exists
      await session.abortTransaction();
      session.endSession();
      // Create a new error object for better stack trace and consistency
      const err = new Error("User not found.");
      err.statusCode = 404;
      return next(err);
    }

    const game = await Game.findById(gameId).session(session);
    if (!game) {
      await session.abortTransaction();
      session.endSession();
      const err = new Error("Game not found.");
      err.statusCode = 404;
      return next(err);
    }

    // --- Business Logic Checks ---
    if (
      game.result ||
      game.status === "finished" ||
      game.status === "cancelled"
    ) {
      await session.abortTransaction();
      session.endSession();
      const err = new Error(
        "Betting is closed for this game (game has finished, has a result, or is cancelled)."
      );
      err.statusCode = 400;
      return next(err);
    }
    // Check if matchDate is valid and in the future
    const matchDateTime = new Date(game.matchDate).getTime();
    if (isNaN(matchDateTime) || matchDateTime < Date.now()) {
      await session.abortTransaction();
      session.endSession();
      const err = new Error(
        "Betting is closed for this game (match has already started or passed)."
      );
      err.statusCode = 400;
      return next(err);
    }
    if (user.walletBalance < stake) {
      await session.abortTransaction();
      session.endSession();
      const err = new Error("Insufficient funds in your wallet.");
      err.statusCode = 400;
      return next(err);
    }

    user.walletBalance -= stake;
    user.walletBalance = parseFloat(user.walletBalance.toFixed(2)); // Ensure precision
    await user.save({ session });

    const bet = new Bet({
      user: userId,
      game: gameId,
      outcome,
      stake,
      status: "pending",
      payout: 0,
    });
    await bet.save({ session });

    await new Transaction({
      user: user._id,
      type: "bet",
      amount: -stake,
      balanceAfter: user.walletBalance,
      bet: bet._id,
      game: game._id,
      description: `Bet on ${game.homeTeam} vs ${game.awayTeam}`,
    }).save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      msg: "Bet placed successfully!",
      bet,
      walletBalance: user.walletBalance,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error); // Pass error to centralized handler
  }
};

// User: Get their bets
exports.getUserBets = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { status, gameId } = req.query;
    const page = req.query.page || 1; // Already validated and toInt-ed
    const limit = req.query.limit || 10; // Already validated and toInt-ed
    const skip = (page - 1) * limit;

    const filter = { user: req.user.id };
    if (status) filter.status = status;
    if (gameId) filter.game = gameId;

    const bets = await Bet.find(filter)
      .populate({
        path: "game",
        select: "homeTeam awayTeam matchDate league result status odds",
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const totalBets = await Bet.countDocuments(filter);

    res.json({
      bets,
      currentPage: page,
      totalPages: Math.ceil(totalBets / limit),
      totalCount: totalBets,
    });
  } catch (error) {
    next(error);
  }
};

// System/Admin: Resolve all bets after a game result is set
exports.resolveBets = async (game, session) => {
  if (!game || !game.result) {
    // console.error("Attempted to resolve bets for a game without a result or invalid game object."); // Use logger
    throw new Error(
      "Cannot resolve bets: Game object or result is invalid for resolution."
    );
  }
  if (!game.odds) {
    // console.error(`Game ${game._id} is missing odds information. Cannot calculate payouts accurately.`); // Use logger
    throw new Error(
      `Game ${game._id} (${game.homeTeam} vs ${game.awayTeam}) is missing odds. Cannot calculate payouts.`
    );
  }

  try {
    const betsToResolve = await Bet.find({ game: game._id, status: "pending" })
      .populate("user")
      .session(session);

    for (let bet of betsToResolve) {
      let payout = 0;
      let won = false;

      if (bet.outcome === game.result) {
        won = true;
        let oddValue = 0;
        if (game.result === "A" && game.odds.home) oddValue = game.odds.home;
        else if (game.result === "B" && game.odds.away)
          oddValue = game.odds.away;
        else if (game.result === "Draw" && game.odds.draw)
          oddValue = game.odds.draw;

        if (oddValue > 0) {
          payout = bet.stake * oddValue;
        } else {
          // This case should be rare if odds are guaranteed by game creation/update logic for all outcomes.
          // console.warn( // Use logger
          //  `Odds for winning outcome '${game.result}' not found for game ${game._id}. Refunding stake for bet ${bet._id}.`
          // );
          payout = bet.stake; // Fallback: Refund stake if specific odd is missing (e.g. odds object exists but not game.odds.home)
        }
      }

      bet.payout = parseFloat(payout.toFixed(2)); // Ensure precision
      bet.status = won ? "won" : "lost";
      await bet.save({ session });

      if (won && bet.user) {
        bet.user.walletBalance += bet.payout;
        bet.user.walletBalance = parseFloat(bet.user.walletBalance.toFixed(2)); // Ensure precision
        await bet.user.save({ session });

        await new Transaction({
          user: bet.user._id,
          type: "win",
          amount: bet.payout,
          balanceAfter: bet.user.walletBalance,
          bet: bet._id,
          game: game._id,
          description: `Win from bet on ${game.homeTeam} vs ${game.awayTeam}`,
        }).save({ session });
        // console.log(`User ${bet.user.username} won ${bet.payout} from bet ${bet._id}. Balance: ${bet.user.walletBalance}`); // Use logger
      } else if (!won) {
        // console.log(`Bet ${bet._id} for game ${game._id} lost.`); // Use logger
      }
    }
    // console.log(`Resolved ${betsToResolve.length} bets for game ${game._id}.`); // Use logger
  } catch (error) {
    // console.error(`Error resolving bets for game ${game._id}:`, error.message); // Use logger
    throw error; // Re-throw to be caught by the caller's transaction logic
  }
};
