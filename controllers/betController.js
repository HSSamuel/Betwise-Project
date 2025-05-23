const Bet = require("../models/Bet");
const Game = require("../models/Game");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

exports.placeBet = async (req, res) => {
  let { gameId, outcome, stake } = req.body;
  const userId = req.user.id;

  try {
    stake = Number(stake); // Ensure numeric

    if (!["A", "B", "Draw"].includes(outcome)) {
      return res.status(400).json({ msg: "Invalid outcome selected" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (user.walletBalance < stake) {
      return res.status(400).json({ msg: "Insufficient funds" });
    }

    const game = await Game.findById(gameId);
    if (!game || game.result) {
      return res.status(400).json({ msg: "Invalid or completed game" });
    }

    // Deduct stake from user wallet
    user.walletBalance -= stake;
    await user.save();

    // Log transaction after deduction
    await new Transaction({
      user: user._id,
      type: "bet",
      amount: -stake,
      balanceAfter: user.walletBalance,
    }).save();

    const bet = new Bet({
      user: userId,
      game: gameId,
      outcome,
      stake,
      status: "pending",
      payout: 0,
    });

    await bet.populate("game");

    res.status(201).json({
      msg: "Bet placed successfully",
      bet,
      walletBalance: user.walletBalance,
    });
  } catch (err) {
    console.error("Error placing bet:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.getUserBets = async (req, res) => {
  try {
    const bets = await Bet.find({ user: req.user.id }).populate("game");

    const formattedBets = bets.map((bet) => ({
      match: `${bet.game.homeTeam} vs ${bet.game.awayTeam}`,
      league: bet.game.league,
      matchDate: bet.game.matchDate,
      outcomeChosen: bet.outcome,
      stake: bet.stake,
      payout: bet.payout,
      status: bet.status,
      result: bet.game.result || "Pending",
    }));

    res.json(formattedBets);
  } catch (err) {
    console.error("Error getting user bets:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.resolveBets = async (game) => {
  const bets = await Bet.find({ game: game._id }).populate("user");

  for (let bet of bets) {
    if (bet.status !== "pending") continue;

    let payout = 0;
    let won = false;

    if (bet.outcome === game.result) {
      if (game.result === "A") payout = bet.stake * game.odds.home;
      else if (game.result === "B") payout = bet.stake * game.odds.away;
      else if (game.result === "Draw") payout = bet.stake * game.odds.draw;

      won = true;
    }

    bet.payout = payout;
    bet.status = won ? "won" : "lost";
    await bet.save();

    if (won) {
      bet.user.walletBalance += payout;
      await bet.user.save();

      await new Transaction({
        user: bet.user._id,
        type: "win",
        amount: payout,
        balanceAfter: bet.user.walletBalance,
      }).save();
    }
  }
};
