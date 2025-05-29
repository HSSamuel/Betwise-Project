const Bet = require("../models/Bet");
const Game = require("../models/Game");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const mongoose = require("mongoose"); // <-- Add mongoose for session

// User: Place a new bet
exports.placeBet = async (req, res, next) => {
  // <-- Added next for error handling
  let { gameId, outcome, stake } = req.body;
  const userId = req.user.id; // From auth middleware

  const session = await mongoose.startSession(); // <-- Start session
  session.startTransaction(); // <-- Start transaction

  try {
    stake = Number(stake);

    // --- Input Validation ---
    if (!gameId || !outcome || !stake) {
      await session.abortTransaction();
      session.endSession(); // Abort and end session
      return res
        .status(400)
        .json({ msg: "Missing required fields: gameId, outcome, stake." }); //
    }
    if (!["A", "B", "Draw"].includes(outcome)) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ msg: "Invalid outcome. Must be 'A', 'B', or 'Draw'." }); //
    }
    if (isNaN(stake) || stake <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ msg: "Invalid stake amount. Must be a positive number." }); //
    }

    // Fetch user and game details (use session for user if it's going to be saved)
    const user = await User.findById(userId).session(session); // <-- Use session for user document
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ msg: "User not found." }); //
    }

    const game = await Game.findById(gameId).session(session); // Can use session here too if game state is critical for the transaction
    if (!game) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ msg: "Game not found." }); //
    }

    // --- Business Logic Checks ---
    if (
      game.result ||
      game.status === "finished" ||
      game.status === "cancelled"
    ) {
      //
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({
          msg: "Betting is closed for this game (game has finished, has a result, or is cancelled).",
        }); //
    }
    if (new Date(game.matchDate) < new Date()) {
      //
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({
          msg: "Betting is closed for this game (match has already started or passed).",
        }); //
    }
    if (user.walletBalance < stake) {
      //
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ msg: "Insufficient funds in your wallet." }); //
    }

    // Deduct stake and update wallet balance
    user.walletBalance -= stake; //
    await user.save({ session }); // <-- Pass session to save operation

    // Create a new bet entry
    const bet = new Bet({
      user: userId,
      game: gameId,
      outcome,
      stake,
      status: "pending", // Initial status
      payout: 0, // Initial payout
    });
    await bet.save({ session }); // <-- Pass session

    // Log the transaction for the bet
    await new Transaction({
      user: user._id,
      type: "bet", //
      amount: -stake, // Negative amount for debit
      balanceAfter: user.walletBalance, //
      bet: bet._id, //
      game: game._id, //
      description: `Bet on ${game.homeTeam} vs ${game.awayTeam}`, //
    }).save({ session }); // <-- Pass session

    await session.commitTransaction(); // <-- Commit transaction
    session.endSession(); // <-- End session

    res.status(201).json({
      msg: "Bet placed successfully!", //
      bet,
      walletBalance: user.walletBalance,
    });
  } catch (err) {
    await session.abortTransaction(); // <-- Abort on error
    session.endSession(); // <-- End session
    // console.error("Error placing bet:", err.message); // Logged by centralized handler
    // res.status(500).json({ msg: "Server error while placing bet." }); // Handled by centralized handler
    next(err); // Pass error to centralized handler
  }
};

// ... (getUserBets remains similar, but can also use next for error handling)
exports.getUserBets = async (req, res, next) => {
  // <-- Added next
  try {
    const { status, gameId } = req.query;
    const filter = { user: req.user.id }; //
    if (status) filter.status = status; //
    if (gameId) filter.game = gameId; //

    const bets = await Bet.find(filter)
      .populate({
        path: "game", //
        select: "homeTeam awayTeam matchDate league result status odds", // Select specific fields from Game
      })
      .sort({ createdAt: -1 }); // Newest bets first

    if (!bets || bets.length === 0) {
      return res.status(404).json({ msg: "No bets found." }); //
    }
    // ... (rest of the formatting logic)
    const formattedBets = bets.map((bet) => ({
      /* ... */
    })); //
    res.json(formattedBets);
  } catch (err) {
    // console.error("Error getting user bets:", err.message); //
    next(err); // Pass error to centralized handler
  }
};

// System/Admin: Resolve all bets after a game result is set
// This function is typically called internally by gameController.setResult
// For atomicity here, the session would need to be passed from gameController.setResult
// or this function itself would need to manage a new transaction if called independently.
// Assuming it's called from gameController.setResult, which will manage the transaction.
exports.resolveBets = async (game, session) => {
  // <-- Accept session as parameter
  if (!game || !game.result) {
    //
    console.error(
      "Attempted to resolve bets for a game without a result or invalid game object."
    ); //
    // If this function manages its own transaction, it would abort here.
    // If part of a larger transaction, this error should be propagated up.
    throw new Error("Cannot resolve bets: Game object or result is invalid.");
  }

  try {
    const betsToResolve = await Bet.find({ game: game._id, status: "pending" })
      .populate("user")
      .session(session); // <-- Use session

    for (let bet of betsToResolve) {
      let payout = 0; //
      let won = false; //

      if (bet.outcome === game.result) {
        //
        won = true;
        if (game.result === "A" && game.odds.home)
          payout = bet.stake * game.odds.home; //
        else if (game.result === "B" && game.odds.away)
          payout = bet.stake * game.odds.away; //
        else if (game.result === "Draw" && game.odds.draw)
          payout = bet.stake * game.odds.draw; //
        else {
          console.warn(
            `Could not calculate payout for bet ${bet._id} - game odds missing for result ${game.result}`
          ); //
          payout = bet.stake; // Fallback: return stake
        }
      }

      bet.payout = won ? parseFloat(payout.toFixed(2)) : 0; //
      bet.status = won ? "won" : "lost"; //
      await bet.save({ session }); // <-- Use session

      if (won && bet.user) {
        bet.user.walletBalance += bet.payout; //
        await bet.user.save({ session }); // <-- Use session

        await new Transaction({
          user: bet.user._id,
          type: "win", //
          amount: bet.payout, //
          balanceAfter: bet.user.walletBalance, //
          bet: bet._id, //
          game: game._id, //
          description: `Win from bet on ${game.homeTeam} vs ${game.awayTeam}`, //
        }).save({ session }); // <-- Use session
        console.log(
          `User ${bet.user.username} won ${bet.payout} from bet ${bet._id}. New balance: ${bet.user.walletBalance}`
        ); //
      } else if (!won) {
        console.log(`Bet ${bet._id} for game ${game._id} was lost.`); //
      }
    }
    console.log(
      `Resolved ${betsToResolve.length} bets for game ${game._id} (${game.homeTeam} vs ${game.awayTeam}).`
    ); //
  } catch (err) {
    console.error(`Error resolving bets for game ${game._id}:`, err.message); //
    // This error should be propagated to the calling function (setResult) to handle the transaction.
    throw err; // Re-throw to be caught by the caller's transaction logic
  }
};
