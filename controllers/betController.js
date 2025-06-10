const { body, query, param, validationResult } = require("express-validator");
const mongoose = require("mongoose");
const Bet = require("../models/Bet");
const Game = require("../models/Game");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { generateInterventionMessage } = require("./aiController");

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
  query("status").optional().isIn(["pending", "won", "lost", "cancelled"]),
  query("gameId").optional().isMongoId(),
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
];

exports.validateGetBetById = [
  param("id")
    .isMongoId()
    .withMessage("A valid bet ID is required in the URL parameter."),
];

// --- NEW VALIDATOR for Multi-Bets ---
exports.validatePlaceMultiBet = [
  body("stake")
    .isFloat({ gt: 0 })
    .withMessage("A positive stake is required.")
    .toFloat(),
  body("selections")
    .isArray({ min: 2, max: 10 })
    .withMessage("A multi-bet must contain between 2 and 10 selections."),

  // Validate each object within the selections array
  body("selections.*.gameId")
    .isMongoId()
    .withMessage("Each selection must have a valid gameId."),
  body("selections.*.outcome")
    .isIn(["A", "B", "Draw"])
    .withMessage("Each selection outcome must be 'A', 'B', or 'Draw'."),

  // Custom validator to ensure no duplicate games in the same bet slip
  body("selections").custom((selections) => {
    const gameIds = selections.map((s) => s.gameId);
    const uniqueGameIds = new Set(gameIds);
    if (uniqueGameIds.size !== gameIds.length) {
      throw new Error(
        "A multi-bet cannot contain multiple selections from the same game."
      );
    }
    return true;
  }),
];

// --- NEW CONTROLLER for Multi-Bets ---
exports.placeMultiBet = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { stake, selections } = req.body;
  const userId = req.user._id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(userId).session(session);
    if (!user) throw new Error("User not found.");
    if (user.walletBalance < stake) throw new Error("Insufficient funds.");

    const gameIds = selections.map((s) => s.gameId);
    const games = await Game.find({
      _id: { $in: gameIds },
      status: "upcoming",
    }).session(session);

    if (games.length !== selections.length) {
      throw new Error(
        "One or more selected games are not available for betting (they may have started or do not exist)."
      );
    }

    let totalOdds = 1;
    const finalSelections = [];

    for (const selection of selections) {
      const game = games.find((g) => g._id.toString() === selection.gameId);
      if (!game) throw new Error(`Game with ID ${selection.gameId} not found.`); // Should be caught by the check above, but good for safety.

      let selectionOdds;
      if (selection.outcome === "A") selectionOdds = game.odds.home;
      else if (selection.outcome === "B") selectionOdds = game.odds.away;
      else if (selection.outcome === "Draw") selectionOdds = game.odds.draw;

      if (!selectionOdds)
        throw new Error(
          `Odds for the selected outcome in game ${game.homeTeam} vs ${game.awayTeam} are not available.`
        );

      totalOdds *= selectionOdds;
      finalSelections.push({
        game: game._id,
        outcome: selection.outcome,
        odds: selectionOdds,
      });
    }

    user.walletBalance -= stake;
    await user.save({ session });

    const multiBet = new Bet({
      user: userId,
      betType: "multi",
      stake,
      totalOdds: parseFloat(totalOdds.toFixed(2)),
      selections: finalSelections,
    });
    await multiBet.save({ session });

    await new Transaction({
      user: user._id,
      type: "bet",
      amount: -stake,
      balanceAfter: user.walletBalance,
      bet: multiBet._id,
      description: `Multi-bet with ${finalSelections.length} selections.`,
    }).save({ session });

    await session.commitTransaction();
    res.status(201).json({
      msg: "Multi-bet placed successfully!",
      bet: multiBet,
      walletBalance: user.walletBalance,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
// --- Controller Functions ---

// This is the single, correct version of the placeBet function with all features integrated.
exports.placeBet = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { gameId, outcome, stake } = req.body;
  const userId = req.user._id;

  try {
    // We fetch the user once at the beginning for all checks
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error("User not found.");
      err.statusCode = 404;
      return next(err);
    }

    // --- 1. ENFORCE BETTING LIMITS ---
    const now = new Date();
    const betLimitInfo = user.limits.weeklyBetCount;
    if (betLimitInfo.limit > 0) {
      if (now > new Date(betLimitInfo.resetDate)) {
        betLimitInfo.currentCount = 0;
        betLimitInfo.resetDate = new Date(
          now.getTime() + 7 * 24 * 60 * 60 * 1000
        );
      }
      if (betLimitInfo.currentCount >= betLimitInfo.limit) {
        throw new Error(
          `You have reached your weekly limit of ${
            betLimitInfo.limit
          } bets. Your limit will reset on ${betLimitInfo.resetDate.toDateString()}.`
        );
      }
    }

    const stakeLimitInfo = user.limits.weeklyStakeAmount;
    if (stakeLimitInfo.limit > 0) {
      if (now > new Date(stakeLimitInfo.resetDate)) {
        stakeLimitInfo.currentAmount = 0;
        stakeLimitInfo.resetDate = new Date(
          now.getTime() + 7 * 24 * 60 * 60 * 1000
        );
      }
      if (stakeLimitInfo.currentAmount + stake > stakeLimitInfo.limit) {
        const remaining = stakeLimitInfo.limit - stakeLimitInfo.currentAmount;
        throw new Error(
          `This bet would exceed your weekly stake limit of $${
            stakeLimitInfo.limit
          }. You have $${remaining.toFixed(2)} remaining.`
        );
      }
    }

    // --- 2. RESPONSIBLE GAMBLING CHECK ---
    const lastSettledBet = await Bet.findOne({
      user: userId,
      status: { $in: ["won", "lost"] },
    }).sort({ updatedAt: -1 });
    if (
      lastSettledBet &&
      lastSettledBet.status === "lost" &&
      stake > lastSettledBet.stake * 2
    ) {
      const interventionMessage = await generateInterventionMessage(
        req.user.username,
        lastSettledBet.stake,
        stake
      );
      const err = new Error(interventionMessage);
      err.statusCode = 422;
      err.intervention = true;
      return next(err);
    }

    // --- 3. PROCEED WITH PLACING THE BET (TRANSACTION) ---
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // We re-fetch the user inside the transaction to ensure data consistency
      const userInSession = await User.findById(userId).session(session);
      const game = await Game.findById(gameId).session(session);
      if (!game) throw new Error("Game not found.");

      if (game.status !== "upcoming" || new Date(game.matchDate) < new Date()) {
        throw new Error("Betting is closed for this game.");
      }
      if (userInSession.walletBalance < stake) {
        throw new Error("Insufficient funds in your wallet.");
      }

      // Update wallet and preferences
      userInSession.walletBalance -= stake;
      userInSession.favoriteLeagues.addToSet(game.league);

      // Update limit counters
      if (userInSession.limits.weeklyBetCount.limit > 0) {
        userInSession.limits.weeklyBetCount.currentCount += 1;
      }
      if (userInSession.limits.weeklyStakeAmount.limit > 0) {
        userInSession.limits.weeklyStakeAmount.currentAmount += stake;
      }
      await userInSession.save({ session });

      const bet = new Bet({
        user: userId,
        game: gameId,
        outcome,
        stake,
        oddsAtTimeOfBet: game.odds,
      });
      await bet.save({ session });

      await new Transaction({
        user: userInSession._id,
        type: "bet",
        amount: -stake,
        balanceAfter: userInSession.walletBalance,
        bet: bet._id,
        game: game._id,
        description: `Bet on ${game.homeTeam} vs ${game.awayTeam}`,
      }).save({ session });

      await session.commitTransaction();
      res.status(201).json({
        msg: "Bet placed successfully!",
        bet,
        walletBalance: userInSession.walletBalance,
      });
    } catch (error) {
      await session.abortTransaction();
      throw error; // Re-throw to be caught by the outer catch block
    } finally {
      session.endSession();
    }
  } catch (error) {
    next(error);
  }
};

// ... (getUserBets, getBetById, and resolveBets functions remain the same)
exports.getUserBets = async (req, res, next) => {
  /* ... */
};
exports.getBetById = async (req, res, next) => {
  /* ... */
};
exports.resolveBets = async (game, session) => {
  /* ... */
};

// --- NEW VALIDATOR for Multi-Bets ---
exports.validatePlaceMultiBet = [
  body("stake")
    .isFloat({ gt: 0 })
    .withMessage("A positive stake is required.")
    .toFloat(),
  body("selections")
    .isArray({ min: 2, max: 10 })
    .withMessage("A multi-bet must contain between 2 and 10 selections."),

  // Validate each object within the selections array
  body("selections.*.gameId")
    .isMongoId()
    .withMessage("Each selection must have a valid gameId."),
  body("selections.*.outcome")
    .isIn(["A", "B", "Draw"])
    .withMessage("Each selection outcome must be 'A', 'B', or 'Draw'."),

  // Custom validator to ensure no duplicate games in the same bet slip
  body("selections").custom((selections) => {
    const gameIds = selections.map((s) => s.gameId);
    const uniqueGameIds = new Set(gameIds);
    if (uniqueGameIds.size !== gameIds.length) {
      throw new Error(
        "A multi-bet cannot contain multiple selections from the same game."
      );
    }
    return true;
  }),
];

// --- NEW CONTROLLER for Multi-Bets ---
exports.placeMultiBet = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { stake, selections } = req.body;
  const userId = req.user._id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(userId).session(session);
    if (!user) throw new Error("User not found.");
    if (user.walletBalance < stake) throw new Error("Insufficient funds.");

    const gameIds = selections.map((s) => s.gameId);
    const games = await Game.find({
      _id: { $in: gameIds },
      status: "upcoming",
    }).session(session);

    if (games.length !== selections.length) {
      throw new Error(
        "One or more selected games are not available for betting (they may have started or do not exist)."
      );
    }

    let totalOdds = 1;
    const finalSelections = [];

    for (const selection of selections) {
      const game = games.find((g) => g._id.toString() === selection.gameId);
      if (!game) throw new Error(`Game with ID ${selection.gameId} not found.`); // Should be caught by the check above, but good for safety.

      let selectionOdds;
      if (selection.outcome === "A") selectionOdds = game.odds.home;
      else if (selection.outcome === "B") selectionOdds = game.odds.away;
      else if (selection.outcome === "Draw") selectionOdds = game.odds.draw;

      if (!selectionOdds)
        throw new Error(
          `Odds for the selected outcome in game ${game.homeTeam} vs ${game.awayTeam} are not available.`
        );

      totalOdds *= selectionOdds;
      finalSelections.push({
        game: game._id,
        outcome: selection.outcome,
        odds: selectionOdds,
      });
    }

    user.walletBalance -= stake;
    await user.save({ session });

    const multiBet = new Bet({
      user: userId,
      betType: "multi",
      stake,
      totalOdds: parseFloat(totalOdds.toFixed(2)),
      selections: finalSelections,
    });
    await multiBet.save({ session });

    await new Transaction({
      user: user._id,
      type: "bet",
      amount: -stake,
      balanceAfter: user.walletBalance,
      bet: multiBet._id,
      description: `Multi-bet with ${finalSelections.length} selections.`,
    }).save({ session });

    await session.commitTransaction();
    res
      .status(201)
      .json({
        msg: "Multi-bet placed successfully!",
        bet: multiBet,
        walletBalance: user.walletBalance,
      });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
