// In: scripts/resolveMultiBets.js

require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const mongoose = require("mongoose");
const Bet = require("../models/Bet");
const Game = require("../models/Game");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

const resolveMultiBets = async () => {
  console.log("🚀 Starting Multi-Bet resolution script...");
  const dbUri = process.env.MONGODB_URI;
  if (!dbUri) {
    console.error("❌ Error: MONGODB_URI is not defined.");
    process.exit(1);
  }

  await mongoose.connect(dbUri);
  console.log("✅ MongoDB connected.");

  try {
    // 1. Find all pending multi-bets
    const pendingMultiBets = await Bet.find({
      betType: "multi",
      status: "pending",
    });
    console.log(
      `ℹ️  Found ${pendingMultiBets.length} pending multi-bets to check.`
    );

    let resolvedCount = 0;

    for (const bet of pendingMultiBets) {
      const gameIds = bet.selections.map((s) => s.game);
      const games = await Game.find({ _id: { $in: gameIds } });

      // 2. Check if all games in the bet slip have finished
      const allGamesFinished = games.every(
        (g) => g.status === "finished" && g.result
      );
      if (!allGamesFinished || games.length !== bet.selections.length) {
        // Skip this bet if one or more games are still upcoming or live
        continue;
      }

      console.log(`- Analyzing bet ${bet._id}... All games have finished.`);

      // 3. Determine the outcome of the multi-bet
      let isBetWon = true;
      for (const selection of bet.selections) {
        const game = games.find((g) => g._id.equals(selection.game));
        if (selection.outcome !== game.result) {
          isBetWon = false;
          break; // One loss is enough to lose the whole bet
        }
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        if (isBetWon) {
          // 4a. If the bet is won, process the payout
          bet.status = "won";
          bet.payout = bet.stake * bet.totalOdds;

          const user = await User.findById(bet.user).session(session);
          user.walletBalance += bet.payout;

          await new Transaction({
            user: user._id,
            type: "win",
            amount: bet.payout,
            balanceAfter: user.walletBalance,
            bet: bet._id,
            description: `Win from multi-bet with ${bet.selections.length} selections.`,
          }).save({ session });

          await user.save({ session });
          console.log(
            `✅ Bet ${bet._id} was WON. Payout: $${bet.payout.toFixed(2)}.`
          );
        } else {
          // 4b. If the bet is lost, update the status
          bet.status = "lost";
          bet.payout = 0;
          console.log(`❌ Bet ${bet._id} was LOST.`);
        }

        await bet.save({ session });
        await session.commitTransaction();
        resolvedCount++;
      } catch (error) {
        await session.abortTransaction();
        console.error(`- Error processing bet ${bet._id}:`, error.message);
      } finally {
        session.endSession();
      }
    }

    console.log(
      `✅ Multi-Bet resolution complete. Settled ${resolvedCount} bets.`
    );
  } catch (error) {
    console.error(
      "❌ An error occurred during the multi-bet resolution process:",
      error
    );
  } finally {
    await mongoose.disconnect();
    console.log("ℹ️ MongoDB disconnected.");
  }
};

resolveMultiBets();
