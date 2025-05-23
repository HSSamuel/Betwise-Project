const Game = require("../models/Game");

exports.createGame = async (req, res) => {
  const { homeTeam, awayTeam, odds, league, matchDate } = req.body;

  try {
    const game = new Game({
      homeTeam,
      awayTeam,
      odds,
      league,
      matchDate,
    });
    await game.save();
    res.status(201).json({
      message: `Match added! ${homeTeam} vs ${awayTeam} is ready for bets!`,
      game,
    });
  } catch (err) {
    console.error("Error creating game:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

exports.getGames = async (req, res) => {
  try {
    const games = await Game.find();
    res.json(games);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

exports.setResult = async (req, res) => {
  const { id } = req.params;
  const { result } = req.body;

  if (!["A", "B", "Draw"].includes(result)) {
    return res.status(400).json({ msg: "Invalid result value" });
  }

  try {
    const game = await Game.findById(id);
    if (!game) return res.status(404).json({ msg: "Game not found" });

    const { resolveBets } = require("./betController");
    game.result = result;
    await resolveBets(game);
    await game.save();

    res.json({ msg: "Result set", game });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};
