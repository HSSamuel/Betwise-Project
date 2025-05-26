const Game = require("../models/Game");
const Bet = require("../models/Bet");
const { resolveBets } = require("./betController"); // For resolving bets when a game result is set

// Admin: Create a new game
exports.createGame = async (req, res) => {
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
    // Check if a similar game (same teams, same date) already exists to prevent duplicates
    const existingGame = await Game.findOne({
      homeTeam,
      awayTeam,
      matchDate: new Date(matchDate).setHours(0, 0, 0, 0), // Compare date part only
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
      status: status || "upcoming", // Default to upcoming if not provided
    });

    await game.save(); // Mongoose validation (including same team check) will run here

    res.status(201).json({
      message: `Match added: ${homeTeam} vs ${awayTeam} on ${new Date(
        matchDate
      ).toLocaleDateString()}.`,
      game,
    });
  } catch (err) {
    console.error("Error creating game:", err.message);
    if (err.name === "ValidationError") {
      return res.status(400).json({ msg: err.message });
    }
    res.status(500).json({ msg: "Server error while creating game." });
  }
};

// Public: Get all games (with optional filtering/pagination in a real app)
exports.getGames = async (req, res) => {
  try {
    // Basic query params for filtering (can be expanded)
    const { league, status, date } = req.query;
    const filter = {};
    if (league) filter.league = league;
    if (status) filter.status = status;
    if (date) {
      // Filter by specific date (matchDate should be on this day)
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      filter.matchDate = { $gte: startDate, $lte: endDate };
    }

    const games = await Game.find(filter).sort({ matchDate: 1 }); // Sort by match date

    if (!games || games.length === 0) {
      return res
        .status(404)
        .json({ msg: "No games found matching your criteria." });
    }
    res.json(games);
  } catch (err) {
    console.error("Error fetching games:", err.message);
    res.status(500).json({ msg: "Server error while fetching games." });
  }
};

// Public: Get a single game by ID
exports.getGameById = async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).json({ msg: "Game not found." });
    }
    res.json(game);
  } catch (err) {
    console.error("Error fetching game by ID:", err.message);
    if (err.kind === "ObjectId") {
      return res.status(400).json({ msg: "Invalid game ID format." });
    }
    res.status(500).json({ msg: "Server error while fetching game." });
  }
};

// Admin: Set the result for a game and process payouts
exports.setResult = async (req, res) => {
  const { id } = req.params; // Game ID
  const { result } = req.body; // Expected result: "A", "B", or "Draw"

  // Validate result value
  if (!["A", "B", "Draw"].includes(result)) {
    return res
      .status(400)
      .json({ msg: "Invalid result value. Must be 'A', 'B', or 'Draw'." });
  }

  try {
    const game = await Game.findById(id);
    if (!game) {
      return res.status(404).json({ msg: "Game not found." });
    }

    if (game.result) {
      return res.status(400).json({
        msg: `Game result already set to ${game.result}. Cannot change.`,
      });
    }
    if (game.status !== "finished" && game.status !== "live") {
      // Typically result is set after game is finished or live
      // Allow setting result if game is upcoming, but ideally it should be 'finished'
      // console.warn(`Setting result for game ${id} which is currently ${game.status}`);
    }

    game.result = result;
    game.status = "finished"; // Update game status
    await game.save();

    // Resolve bets related to this game (payouts handled in resolveBets)
    await resolveBets(game);

    res.json({
      msg: `Result for game ${game.homeTeam} vs ${game.awayTeam} set to '${result}'. Bets are being resolved.`,
      game,
    });
  } catch (err) {
    console.error("Error setting game result:", err.message);
    res.status(500).json({ msg: "Server error while setting game result." });
  }
};

// Admin: Update game details (e.g., odds, matchDate, status before it starts)
exports.updateGame = async (req, res) => {
  const { id } = req.params;
  const updates = req.body; // Contains fields to update: odds, matchDate, status, etc.

  try {
    const game = await Game.findById(id);
    if (!game) {
      return res.status(404).json({ msg: "Game not found." });
    }

    // Prevent updates if the game has started or finished, unless it's a result update (handled by setResult)
    if (game.status === "live" || game.status === "finished") {
      // Allow specific updates like status to 'cancelled' or minor corrections if needed
      if (
        updates.status &&
        updates.status !== "cancelled" &&
        Object.keys(updates).length > 1
      ) {
        return res.status(400).json({
          msg: "Cannot update game details for live or finished games, except for cancellation.",
        });
      }
    }
    if (
      updates.matchDate &&
      new Date(updates.matchDate) < new Date() &&
      game.status === "upcoming"
    ) {
      return res.status(400).json({
        msg: "Match date cannot be set to the past for an upcoming game.",
      });
    }

    // Update allowed fields
    Object.keys(updates).forEach((key) => {
      if (key === "odds" && typeof updates.odds === "object") {
        game.odds = { ...game.odds, ...updates.odds };
      } else if (key !== "_id") {
        // Prevent _id from being updated
        game[key] = updates[key];
      }
    });

    await game.save(); // Mongoose validation will run
    res.json({ msg: "Game updated successfully.", game });
  } catch (err) {
    console.error("Error updating game:", err.message);
    if (err.name === "ValidationError") {
      return res.status(400).json({ msg: err.message });
    }
    res.status(500).json({ msg: "Server error while updating game." });
  }
};

// Admin: Cancel a game
exports.cancelGame = async (req, res) => {
  const { id } = req.params;
  try {
    const game = await Game.findById(id);
    if (!game) {
      return res.status(404).json({ msg: "Game not found." });
    }

    if (game.status === "finished" && game.result) {
      return res.status(400).json({
        msg: "Cannot cancel a game that has already finished and has a result.",
      });
    }

    // If game is cancelled, update its status and refund all bets placed on it.
    if (game.status !== "cancelled") {
      game.status = "cancelled";
      game.result = null; // Ensure no result if cancelled
      await game.save();

      // Find all bets for this game
      const betsToRefund = await Bet.find({
        game: game._id,
        status: "pending",
      });

      for (const bet of betsToRefund) {
        const user = await User.findById(bet.user);
        if (user) {
          user.walletBalance += bet.stake; // Refund the stake
          await user.save();

          // Log the refund transaction
          await new Transaction({
            user: user._id,
            type: "refund",
            amount: bet.stake,
            balanceAfter: user.walletBalance,
            bet: bet._id,
            game: game._id,
            description: `Refund for cancelled game: ${game.homeTeam} vs ${game.awayTeam}`,
          }).save();
        }
        bet.status = "cancelled"; // Update bet status
        await bet.save();
      }
      res.json({
        msg: `Game ${game.homeTeam} vs ${game.awayTeam} cancelled. All pending bets refunded.`,
        game,
      });
    } else {
      res.status(400).json({ msg: "Game is already cancelled." });
    }
  } catch (err) {
    console.error("Error cancelling game:", err.message);
    res.status(500).json({ msg: "Server error while cancelling game." });
  }
};
// Admin: Delete a game (only if it hasn't started yet)