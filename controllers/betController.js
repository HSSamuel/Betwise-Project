const Bet = require("../models/Bet");
const Game = require("../models/Game");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

// User: Place a new bet
exports.placeBet = async (req, res) => {
  let { gameId, outcome, stake } = req.body;
  const userId = req.user.id; // From auth middleware

  try {
    stake = Number(stake);

    // --- Input Validation ---
    if (!gameId || !outcome || !stake) {
      return res
        .status(400)
        .json({ msg: "Missing required fields: gameId, outcome, stake." });
    }
    if (!["A", "B", "Draw"].includes(outcome)) {
      return res
        .status(400)
        .json({ msg: "Invalid outcome. Must be 'A', 'B', or 'Draw'." });
    }
    if (isNaN(stake) || stake <= 0) {
      return res
        .status(400)
        .json({ msg: "Invalid stake amount. Must be a positive number." });
    }

    // Fetch user and game details
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found." });

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ msg: "Game not found." });

    // --- Business Logic Checks ---
    if (
      game.result ||
      game.status === "finished" ||
      game.status === "cancelled"
    ) {
      return res
        .status(400)
        .json({
          msg: "Betting is closed for this game (game has finished, has a result, or is cancelled).",
        });
    }
    if (new Date(game.matchDate) < new Date()) {
      return res
        .status(400)
        .json({
          msg: "Betting is closed for this game (match has already started or passed).",
        });
    }
    if (user.walletBalance < stake) {
      return res
        .status(400)
        .json({ msg: "Insufficient funds in your wallet." });
    }

    // Deduct stake and update wallet balance
    user.walletBalance -= stake;
    await user.save();

    // Create a new bet entry
    const bet = new Bet({
      user: userId,
      game: gameId,
      outcome,
      stake,
      status: "pending", // Initial status
      payout: 0, // Initial payout
    });
    await bet.save();

    // Log the transaction for the bet
    await new Transaction({
      user: user._id,
      type: "bet",
      amount: -stake, // Negative amount for debit
      balanceAfter: user.walletBalance,
      bet: bet._id,
      game: game._id,
      description: `Bet on ${game.homeTeam} vs ${game.awayTeam}`,
    }).save();

    res.status(201).json({
      msg: "Bet placed successfully!",
      bet,
      walletBalance: user.walletBalance,
    });
  } catch (err) {
    console.error("Error placing bet:", err.message);
    // If bet placement fails after deducting balance, ideally implement a rollback or compensating transaction.
    // For now, just log and return server error.
    res.status(500).json({ msg: "Server error while placing bet." });
  }
};

// User: Get all bets placed by the current user
exports.getUserBets = async (req, res) => {
  try {
    const { status, gameId } = req.query;
    const filter = { user: req.user.id };
    if (status) filter.status = status;
    if (gameId) filter.game = gameId;

    const bets = await Bet.find(filter)
      .populate({
        path: "game",
        select: "homeTeam awayTeam matchDate league result status odds", // Select specific fields from Game
      })
      .sort({ createdAt: -1 }); // Newest bets first

    if (!bets || bets.length === 0) {
      return res.status(404).json({ msg: "No bets found." });
    }

    // Format bets for a cleaner response (optional)
    const formattedBets = bets.map((bet) => ({
      _id: bet._id,
      gameDetails: bet.game
        ? {
            id: bet.game._id,
            match: `${bet.game.homeTeam} vs ${bet.game.awayTeam}`,
            league: bet.game.league,
            matchDate: bet.game.matchDate,
            gameStatus: bet.game.status,
            result: bet.game.result || "Pending",
            odds: bet.game.odds,
          }
        : { id: bet.game, match: "Game details not available" }, // Handle if game was deleted, though unlikely with DB refs
      outcomeChosen: bet.outcome,
      stake: bet.stake,
      payout: bet.payout,
      status: bet.status,
      createdAt: bet.createdAt,
      updatedAt: bet.updatedAt,
    }));

    res.json(formattedBets);
  } catch (err) {
    console.error("Error getting user bets:", err.message);
    res.status(500).json({ msg: "Server error while fetching user bets." });
  }
};

// System/Admin: Resolve all bets after a game result is set
// This function is typically called internally by gameController.setResult
exports.resolveBets = async (game) => {
  if (!game || !game.result) {
    console.error(
      "Attempted to resolve bets for a game without a result or invalid game object."
    );
    return; // Or throw an error
  }

  try {
    // Find all pending bets for this game
    const betsToResolve = await Bet.find({
      game: game._id,
      status: "pending",
    }).populate("user");

    for (let bet of betsToResolve) {
      let payout = 0;
      let won = false;

      // Check if the user's bet matches the game result
      if (bet.outcome === game.result) {
        won = true;
        // Calculate payout based on the outcome and game odds
        if (game.result === "A" && game.odds.home)
          payout = bet.stake * game.odds.home;
        else if (game.result === "B" && game.odds.away)
          payout = bet.stake * game.odds.away;
        else if (game.result === "Draw" && game.odds.draw)
          payout = bet.stake * game.odds.draw;
        else {
          console.warn(
            `Could not calculate payout for bet ${bet._id} - game odds missing for result ${game.result}`
          );
          payout = bet.stake; // Fallback: return stake if odds are missing (or handle as loss)
        }
      }

      // Update bet status and payout
      bet.payout = won ? parseFloat(payout.toFixed(2)) : 0; // Ensure payout is a number with 2 decimal places
      bet.status = won ? "won" : "lost";
      await bet.save();

      // If the user won, update their wallet and record the win transaction
      if (won && bet.user) {
        // bet.user should be populated
        bet.user.walletBalance += bet.payout;
        await bet.user.save();

        // Log the win transaction
        await new Transaction({
          user: bet.user._id,
          type: "win",
          amount: bet.payout,
          balanceAfter: bet.user.walletBalance,
          bet: bet._id,
          game: game._id,
          description: `Win from bet on ${game.homeTeam} vs ${game.awayTeam}`,
        }).save();
        console.log(
          `User ${bet.user.username} won ${bet.payout} from bet ${bet._id}. New balance: ${bet.user.walletBalance}`
        );
      } else if (!won) {
        console.log(`Bet ${bet._id} for game ${game._id} was lost.`);
      }
    }
    console.log(
      `Resolved ${betsToResolve.length} bets for game ${game._id} (${game.homeTeam} vs ${game.awayTeam}).`
    );
  } catch (err) {
    console.error(`Error resolving bets for game ${game._id}:`, err.message);
    // Depending on the error, might need a retry mechanism or manual intervention
    // For now, just logging. This function is critical.
  }
};
