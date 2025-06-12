// In: controllers/aiController.js

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { body, validationResult } = require("express-validator");
const Game = require("../models/Game");
const Bet = require("../models/Bet");
const User = require("../models/User");

// Initialize the Google AI client with your API key
if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not defined in the .env file.");
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- Controller Functions ---

exports.handleChat = async (req, res, next) => {
  try {
    // Now expecting 'message' and an optional 'history' array from the client
    const { message, history = [] } = req.body;

    if (!message) {
      const err = new Error(
        'A "message" field is required in the request body.'
      );
      err.statusCode = 400;
      return next(err);
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const systemPrompt = `You are a friendly and helpful customer support assistant for a sports betting app called "BetWise". Your goal is to answer user questions clearly and concisely. Do not provide betting advice or predict game outcomes. If a question is outside the scope of the BetWise app, politely state that you can only answer questions related to BetWise. The user asking the question is ${req.user.username}.`;

    // Initialize the chat with the provided history.
    // For the first message, the history will be empty.
    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt }] },
        {
          role: "model",
          parts: [{ text: "Hello! How can I help you with BetWise today?" }],
        },
        ...history, // Spread the existing chat history here
      ],
      generationConfig: { maxOutputTokens: 200 },
    });

    const result = await chat.sendMessage(message);
    const response = result.response;
    const replyText = response.text();

    // Construct the new, updated history to send back to the client
    const updatedHistory = [
      ...history,
      {
        role: "user",
        parts: [{ text: message }],
      },
      {
        role: "model",
        parts: [{ text: replyText }],
      },
    ];

    // Send back both the reply and the new history
    res.status(200).json({
      reply: replyText,
      updatedHistory: updatedHistory,
    });
  } catch (error) {
    console.error("AI chat handler error:", error);
    next(error);
  }
};

exports.generateGameSummary = async (homeTeam, awayTeam, league) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `You are a sports writer for a betting app called "BetWise". Write a short, exciting, and neutral 1-2 sentence match preview for an upcoming game in the "${league}" between "${homeTeam}" (home) and "${awayTeam}" (away). Do not predict a winner.`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error("Error generating game summary:", error);
    return "A highly anticipated match is coming up.";
  }
};

exports.generateInterventionMessage = async (
  username,
  lastBetStake,
  newBetStake
) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `You are a caring and supportive responsible gambling assistant for "BetWise". A user named "${username}" lost a bet of $${lastBetStake.toFixed(
      2
    )} and is now trying to place a much larger bet of $${newBetStake.toFixed(
      2
    )}. This could be "loss chasing". Generate a short, gentle, non-judgmental pop-up message. Suggest taking a brief pause. Do not use the term "loss chasing".`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error("Error generating intervention message:", error);
    return "Just a friendly check-in. It's always a good idea to bet responsibly. Are you sure you wish to proceed?";
  }
};

exports.validateAnalyzeGame = [
  body("gameId").isMongoId().withMessage("A valid gameId is required."),
];

exports.analyzeGame = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { gameId } = req.body;
    const game = await Game.findById(gameId);
    if (!game) {
      const err = new Error("Game not found.");
      err.statusCode = 404;
      return next(err);
    }
    if (game.status !== "upcoming") {
      const err = new Error(
        "AI analysis is only available for upcoming games."
      );
      err.statusCode = 400;
      return next(err);
    }
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `You are a neutral sports analyst. Provide a brief, data-driven analysis for the upcoming match between ${game.homeTeam} (Home) and ${game.awayTeam} (Away) in the ${game.league}. Focus on recent form or key matchups. Do not predict a winner. Keep it to 2-3 sentences.`;
    const result = await model.generateContent(prompt);
    res.status(200).json({ analysis: result.response.text().trim() });
  } catch (error) {
    console.error("AI game analysis error:", error);
    next(error);
  }
};

exports.getBettingFeedback = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentBets = await Bet.find({
      user: userId,
      createdAt: { $gte: sevenDaysAgo },
    });

    if (recentBets.length === 0) {
      return res.status(200).json({
        feedback:
          "You haven't placed any bets in the last 7 days. Remember to always play responsibly.",
      });
    }

    const totalStaked = recentBets.reduce((sum, bet) => sum + bet.stake, 0);
    const betCount = recentBets.length;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `You are a caring and non-judgmental responsible gambling assistant. A user named ${
      req.user.username
    } has asked for feedback. Their data for the last 7 days: ${betCount} bets totaling $${totalStaked.toFixed(
      2
    )}. Based on this, provide a short, supportive message. If activity seems high (e.g., >15 bets or >$500), gently suggest considering tools like setting limits. Do not give financial advice. Focus on well-being.`;
    const result = await model.generateContent(prompt);
    res.status(200).json({ feedback: result.response.text().trim() });
  } catch (error) {
    console.error("AI betting feedback error:", error);
    next(error);
  }
};

// This is the single, correct version of this function. The old one has been removed.
exports.parseBetIntent = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) {
      const err = new Error(
        'A "text" field containing the user\'s sentence is required.'
      );
      err.statusCode = 400;
      return next(err);
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `From the user's text, extract the betting information into a valid JSON object. The JSON object should have the following keys: "stake" (number), "teamToBetOn" (string), and "opponentTeam" (string, if mentioned). If any piece of information is missing, set its value to null. User's text: "${text}"`;
    const result = await model.generateContent(prompt);
    const rawAiText = result.response.text();
    const jsonMatch = rawAiText.match(/\{[\s\S]*\}/);

    if (!jsonMatch || !jsonMatch[0]) {
      throw new Error(
        "I had trouble understanding that. Could you please rephrase?"
      );
    }

    const intent = JSON.parse(jsonMatch[0]);
    if (!intent.stake || !intent.teamToBetOn) {
      throw new Error(
        "I couldn't determine the stake and which team you want to bet on. Please be more specific."
      );
    }

    const teamToBetOnRegex = new RegExp(intent.teamToBetOn, "i");
    const opponentTeamRegex = intent.opponentTeam
      ? new RegExp(intent.opponentTeam, "i")
      : null;

    let gameFilter = {
      status: "upcoming",
      $or: [{ homeTeam: teamToBetOnRegex }, { awayTeam: teamToBetOnRegex }],
    };

    if (opponentTeamRegex) {
      gameFilter = {
        status: "upcoming",
        $or: [
          { homeTeam: teamToBetOnRegex, awayTeam: opponentTeamRegex },
          { homeTeam: opponentTeamRegex, awayTeam: teamToBetOnRegex },
        ],
      };
    }

    const game = await Game.findOne(gameFilter);
    if (!game) {
      return res.status(404).json({
        message:
          "Sorry, I couldn't find an upcoming match for the team(s) you mentioned.",
      });
    }

    const homeTeamName = game.homeTeam.toLowerCase();
    const teamToBetOnName = intent.teamToBetOn.toLowerCase();
    let outcome = homeTeamName.includes(teamToBetOnName) ? "A" : "B";

    res.status(200).json({
      message: "I've prepared this bet slip for you. Please confirm.",
      success: true,
      betSlip: {
        gameId: game._id,
        gameDetails: `${game.homeTeam} vs ${game.awayTeam}`,
        stake: intent.stake,
        outcome: outcome,
        betOn: intent.teamToBetOn,
      },
    });
  } catch (error) {
    console.error("AI parseBetIntent handler error:", error);
    next(error);
  }
};

// --- FUNCTION for Personalized Limit Suggestions ---
exports.generateLimitSuggestion = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // 1. Analyze user's betting history over the last 30 days
    const recentBets = await Bet.find({
      user: userId,
      createdAt: { $gte: thirtyDaysAgo },
    });

    if (recentBets.length < 5) {
      // Don't suggest if there's not enough data
      return res.status(200).json({
        suggestion:
          "We need a bit more betting history before we can suggest personalized limits. Keep playing responsibly!",
      });
    }

    const totalStaked = recentBets.reduce((sum, bet) => sum + bet.stake, 0);
    const averageWeeklyStake = (totalStaked / 4.28).toFixed(0); // Approx weeks in 30 days
    const averageWeeklyBetCount = (recentBets.length / 4.28).toFixed(0);

    // 2. Ask the AI to generate a supportive suggestion based on the data
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
          You are a caring and supportive responsible gambling assistant for "BetWise".
          A user named "${req.user.username}" has asked for a weekly limit suggestion.
          Their average activity over the last 30 days is:
          - Average weekly bet count: ~${averageWeeklyBetCount} bets
          - Average weekly amount staked: ~$${averageWeeklyStake}

          Your task is to generate a short, helpful, and non-judgmental message suggesting weekly limits based on their average activity.
          - Suggest a bet count limit slightly above their average (e.g., average + 5).
          - Suggest a stake amount limit slightly above their average (e.g., average + 25%).
          - Frame it as a helpful tool for staying in control.
          - Do NOT be alarming or give financial advice.
      `;

    const result = await model.generateContent(prompt);
    const suggestionText = result.response.text().trim();

    res.status(200).json({
      suggestion: suggestionText,
      suggestedLimits: {
        betCount: Math.ceil(averageWeeklyBetCount / 5) * 5 + 5, // Round up and add 5
        stakeAmount: Math.ceil((averageWeeklyStake * 1.25) / 10) * 10, // Round up to nearest 10
      },
    });
  } catch (error) {
    console.error("AI limit suggestion error:", error);
    next(error);
  }
};
