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
      const userInSession = await User.findById(userId).session(session);
      const game = await Game.findById(gameId).session(session);
      if (!game) throw new Error("Game not found.");

      if (game.status !== "upcoming" || new Date(game.matchDate) < new Date()) {
        throw new Error("Betting is closed for this game.");
      }
      if (userInSession.walletBalance < stake) {
        throw new Error("Insufficient funds in your wallet.");
      }

      // --- FIX IS HERE ---
      // Determine the specific odd for the chosen outcome
      let selectedOdd;
      if (outcome === "A") selectedOdd = game.odds.home;
      else if (outcome === "B") selectedOdd = game.odds.away;
      else if (outcome === "Draw") selectedOdd = game.odds.draw;

      if (!selectedOdd) {
        throw new Error("Odds for the selected outcome are not available.");
      }
      // --- END FIX ---

      userInSession.walletBalance -= stake;
      userInSession.favoriteLeagues.addToSet(game.league);

      if (userInSession.limits.weeklyBetCount.limit > 0) {
        userInSession.limits.weeklyBetCount.currentCount += 1;
      }
      if (userInSession.limits.weeklyStakeAmount.limit > 0) {
        userInSession.limits.weeklyStakeAmount.currentAmount += stake;
      }
      await userInSession.save({ session });

      const bet = new Bet({
        user: userId,
        betType: "single", // Explicitly set betType
        stake,
        totalOdds: selectedOdd, // Provide the required totalOdds
        selections: [
          {
            // Use the modern 'selections' array for consistency
            game: gameId,
            outcome: outcome,
            odds: selectedOdd,
          },
        ],
        // Legacy fields for backward compatibility if needed, but not primary
        game: gameId,
        outcome: outcome,
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
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    next(error);
  }
};

// ... (getUserBets, getBetById, and resolveBets functions remain the same)
exports.getUserBets = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { status, gameId, page = 1, limit = 10 } = req.query;

    // Base filter to only get bets for the logged-in user
    const filter = { user: req.user._id };

    // Add optional filters from query parameters
    if (status) filter.status = status;
    if (gameId) filter["selections.game"] = gameId; // Filter by a game within the selections array

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute the query with sorting and pagination
    const bets = await Bet.find(filter)
      .sort({ createdAt: -1 }) // Show newest bets first
      .skip(skip)
      .limit(limit)
      // Populate game details selectively to improve performance
      .populate({
        path: "selections.game",
        select: "homeTeam awayTeam league matchDate result",
      })
      .lean(); // Use .lean() for faster, read-only operations

    // Get the total count of documents for pagination metadata
    const totalBets = await Bet.countDocuments(filter);

    res.status(200).json({
      bets,
      currentPage: page,
      totalPages: Math.ceil(totalBets / limit),
      totalCount: totalBets,
    });
  } catch (error) {
    // Pass any errors to the global error handler
    next(error);
  }
};

exports.getBetById = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const betId = req.params.id;
    const userId = req.user._id; // Get the ID of the logged-in user from the auth middleware

    // Find a bet that matches the betId AND belongs to the currently logged-in user
    const bet = await Bet.findOne({ _id: betId, user: userId })
      .populate({
        path: "selections.game", // Populate the game details within the selections array
        select:
          "homeTeam awayTeam league matchDate result homeTeamLogo awayTeamLogo",
      })
      .lean(); // Use .lean() for faster, read-only queries

    // If no bet is found, it either doesn't exist or belongs to another user
    if (!bet) {
      const err = new Error(
        "Bet not found or you do not have permission to view it."
      );
      err.statusCode = 404;
      return next(err);
    }

    // If successful, send the bet details
    res.status(200).json(bet);
  } catch (error) {
    next(error);
  }
};

exports.resolveBets = async (game, session) => {
  // Find all pending single bets for the game that just finished
  const betsToResolve = await Bet.find({
    game: game._id,
    status: "pending",
    betType: "single", // Only resolve single bets here
  }).session(session);

  if (betsToResolve.length === 0) {
    console.log(`No pending single bets to resolve for game: ${game._id}`);
    return; // Exit if there's nothing to do
  }

  console.log(
    `Resolving ${betsToResolve.length} single bets for game: ${game._id}`
  );

  for (const bet of betsToResolve) {
    const user = await User.findById(bet.user).session(session);
    if (!user) {
      console.warn(`User for bet ${bet._id} not found. Skipping.`);
      continue;
    }

    // Check if the user's predicted outcome matches the actual game result
    if (bet.outcome === game.result) {
      // --- Bet is WON ---
      let winningOdds;
      if (bet.outcome === "A") winningOdds = bet.oddsAtTimeOfBet.home;
      else if (bet.outcome === "B") winningOdds = bet.oddsAtTimeOfBet.away;
      else winningOdds = bet.oddsAtTimeOfBet.draw;

      const payout = bet.stake * winningOdds;
      bet.status = "won";
      bet.payout = parseFloat(payout.toFixed(2));

      // Add winnings to the user's wallet
      user.walletBalance += bet.payout;

      // Create a transaction record for the win
      await new Transaction({
        user: user._id,
        type: "win",
        amount: bet.payout,
        balanceAfter: user.walletBalance,
        bet: bet._id,
        game: game._id,
        description: `Winnings for bet on ${game.homeTeam} vs ${game.awayTeam}`,
      }).save({ session });
    } else {
      // --- Bet is LOST ---
      bet.status = "lost";
      bet.payout = 0;
    }

    // Save the updated bet and user documents within the transaction
    await bet.save({ session });
    await user.save({ session });
  }
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
