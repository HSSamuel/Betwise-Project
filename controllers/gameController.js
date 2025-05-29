const Game = require("../models/Game");
const Bet = require("../models/Bet");
const User = require("../models/User"); // <-- Added for cancelGame
const Transaction = require("../models/Transaction"); // <-- Added for cancelGame
const { resolveBets } = require("./betController");
const mongoose = require("mongoose"); // <-- Added for sessions

// Admin: Create a new game
exports.createGame = async (req, res, next) => {
  // <-- Added next
  const { homeTeam, awayTeam, odds, league, matchDate, status } = req.body;

  // Basic validation for required fields
  if (!homeTeam || !awayTeam || !odds || !league || !matchDate) {
    return res.status(400).json({
      msg: "Missing required fields: homeTeam, awayTeam, odds (home, away, draw), league, matchDate.",
    });
  }
  if (!odds.home || !odds.away || !odds.draw) {
    return res
      .status(400)
      .json({ msg: "Odds must include home, away, and draw values." });
  }
  if (new Date(matchDate) < new Date()) {
    return res.status(400).json({ msg: "Match date cannot be in the past." });
  }

  try {
    const existingGame = await Game.findOne({
      homeTeam,
      awayTeam,
      matchDate: new Date(matchDate).setHours(0, 0, 0, 0),
    });

    if (existingGame) {
      return res
        .status(400)
        .json({ msg: "A game with these teams on this date already exists." });
    }

    const game = new Game({
      homeTeam,
      awayTeam,
      odds,
      league,
      matchDate,
      status: status || "upcoming",
    });

    await game.save();

    res.status(201).json({
      message: `Match added: ${homeTeam} vs ${awayTeam} on ${new Date(
        matchDate
      ).toLocaleDateString()}.`,
      game,
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      // For specific client errors like validation, direct response can be clearer
      return res.status(400).json({ msg: err.message });
    }
    next(err); // Pass other errors to the centralized handler
  }
};

// Public: Get all games
exports.getGames = async (req, res, next) => {
  // <-- Added next
  try {
    const { league, status, date } = req.query;
    const filter = {};
    if (league) filter.league = league;
    if (status) filter.status = status;
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      filter.matchDate = { $gte: startDate, $lte: endDate };
    }

    const games = await Game.find(filter).sort({ matchDate: 1 });

    if (!games || games.length === 0) {
      return res
        .status(404)
        .json({ msg: "No games found matching your criteria." });
    }
    res.json(games);
  } catch (err) {
    next(err); // Pass errors to the centralized handler
  }
};

// Public: Get a single game by ID
exports.getGameById = async (req, res, next) => {
  // <-- Added next
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).json({ msg: "Game not found." });
    }
    res.json(game);
  } catch (err) {
    if (err.kind === "ObjectId") {
      return res.status(400).json({ msg: "Invalid game ID format." });
    }
    next(err); // Pass other errors to the centralized handler
  }
};

// Admin: Set the result for a game and process payouts
exports.setResult = async (req, res, next) => {
  // <-- Added next
  const { id } = req.params;
  const { result } = req.body;

  if (!["A", "B", "Draw"].includes(result)) {
    return res
      .status(400)
      .json({ msg: "Invalid result value. Must be 'A', 'B', or 'Draw'." });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const game = await Game.findById(id).session(session); // <-- Use session
    if (!game) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ msg: "Game not found." });
    }

    if (game.result) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        msg: `Game result already set to ${game.result}. Cannot change.`,
      });
    }
    // Optional: Add more checks for game.status if needed, e.g., game must be 'live' or 'upcoming'

    game.result = result;
    game.status = "finished";
    await game.save({ session }); // <-- Use session for save

    // Resolve bets related to this game (payouts handled in resolveBets)
    // Ensure resolveBets is adapted to use the session for all its DB operations
    await resolveBets(game, session); // <-- Pass session

    await session.commitTransaction();
    session.endSession();

    res.json({
      msg: `Result for game ${game.homeTeam} vs ${game.awayTeam} set to '${result}'. Bets are being resolved.`,
      game,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err); // Pass error to the centralized handler
  }
};

// Admin: Update game details
exports.updateGame = async (req, res, next) => {
  // <-- Added next
  const { id } = req.params;
  const updates = req.body;

  // It's generally safer NOT to run updates like odds changes within a transaction
  // unless absolutely necessary and all side-effects are contained.
  // For this example, keeping it simple without a transaction.
  // If this operation had financial implications or multi-document updates, a transaction would be advised.
  try {
    const game = await Game.findById(id);
    if (!game) {
      return res.status(404).json({ msg: "Game not found." });
    }

    if (game.status === "live" || game.status === "finished") {
      if (
        updates.status &&
        updates.status !== "cancelled" && // Allow update to 'cancelled'
        Object.keys(updates).length > 1
      ) {
        return res.status(400).json({
          msg: "Cannot update most game details for live or finished games, except for cancellation.",
        });
      }
    }
    if (
      updates.matchDate &&
      new Date(updates.matchDate) < new Date() &&
      game.status === "upcoming" // Only a concern if changing date of an upcoming game to past
    ) {
      return res.status(400).json({
        msg: "Match date cannot be set to the past for an upcoming game.",
      });
    }

    Object.keys(updates).forEach((key) => {
      if (key === "odds" && typeof updates.odds === "object") {
        game.odds = { ...game.odds, ...updates.odds };
      } else if (key !== "_id") {
        game[key] = updates[key];
      }
    });

    await game.save();
    res.json({ msg: "Game updated successfully.", game });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ msg: err.message });
    }
    next(err); // Pass other errors to the centralized handler
  }
};

// Admin: Cancel a game
exports.cancelGame = async (req, res, next) => {
  // <-- Added next
  const { id } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const game = await Game.findById(id).session(session); // <-- Use session
    if (!game) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ msg: "Game not found." });
    }

    if (game.status === "finished" && game.result) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        msg: "Cannot cancel a game that has already finished and has a result.",
      });
    }

    if (game.status !== "cancelled") {
      game.status = "cancelled";
      game.result = null;
      await game.save({ session }); // <-- Use session

      const betsToRefund = await Bet.find({
        game: game._id,
        status: "pending", // Only refund pending bets
      }).session(session); // <-- Use session

      for (const bet of betsToRefund) {
        const user = await User.findById(bet.user).session(session); // <-- Use session
        if (user) {
          user.walletBalance += bet.stake;
          await user.save({ session }); // <-- Use session

          await new Transaction({
            user: user._id,
            type: "refund",
            amount: bet.stake,
            balanceAfter: user.walletBalance,
            bet: bet._id,
            game: game._id,
            description: `Refund for cancelled game: ${game.homeTeam} vs ${game.awayTeam}`,
          }).save({ session }); // <-- Use session
        }
        bet.status = "cancelled";
        await bet.save({ session }); // <-- Use session
      }

      await session.commitTransaction();
      session.endSession();

      res.json({
        msg: `Game ${game.homeTeam} vs ${game.awayTeam} cancelled. All pending bets refunded.`,
        game,
      });
    } else {
      // If already cancelled, no need to abort transaction if no DB operations were attempted before this check.
      session.endSession(); // Just end the session if no transaction started or if it's already aborted.
      res.status(400).json({ msg: "Game is already cancelled." });
    }
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err); // Pass error to the centralized handler
  }
};
