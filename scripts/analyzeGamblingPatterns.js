// In: scripts/analyzeGamblingPatterns.js

require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});
const mongoose = require("mongoose");
const axios = require("axios"); // Import axios for making API calls
const User = require("../models/User");
const Bet = require("../models/Bet");

const ML_MODEL_API_URL = process.env.ML_MODEL_API_URL;

async function analyzeUsers() {
  console.log("🚀 Starting ML-Powered Responsible Gambling analysis script...");
  const dbUri = process.env.MONGODB_URI;

  if (!dbUri) {
    console.error("❌ Error: MONGODB_URI is not defined.");
    process.exit(1);
  }

  if (!ML_MODEL_API_URL) {
    console.error(
      "❌ Error: ML_MODEL_API_URL is not defined in your .env file."
    );
    process.exit(1);
  }

  console.log("DATABASE_URI:", dbUri);
  await mongoose.connect(dbUri);
  console.log("✅ MongoDB connected.");

  try {
    const users = await User.find({});
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const user of users) {
      const recentBets = await Bet.find({
        user: user._id,
        createdAt: { $gte: twentyFourHoursAgo },
      });

      // If no recent activity, ensure user is marked as 'ok'.
      if (recentBets.length === 0) {
        if (user.responsibleGambling.status === "at_risk") {
          user.responsibleGambling.status = "ok";
          user.responsibleGambling.riskFactors = [];
          await user.save();
          console.log(
            `ℹ️ User ${user.username} status reset to 'ok' due to inactivity.`
          );
        }
        continue; // Move to the next user
      }

      // 1. Aggregate features for the ML model
      const totalStaked = recentBets.reduce((sum, bet) => sum + bet.stake, 0);
      const betCount = recentBets.length;
      const averageStake = totalStaked / betCount;

      const features = {
        bet_count_24h: betCount,
        total_staked_24h: totalStaked,
        average_stake_24h: averageStake,
        // You could add more features here, like user's total balance, etc.
        // current_wallet_balance: user.walletBalance
      };

      try {
        // 2. Call the external ML Model API with the feature set
        console.log(
          `- Analyzing user ${user.username} with features:`,
          features
        );
        const predictionResponse = await axios.post(ML_MODEL_API_URL, features);
        const prediction = predictionResponse.data; // e.g., { "is_at_risk": true, "risk_score": 0.85, "reason": "High frequency betting" }

        // 3. Update user status based on the model's prediction
        user.responsibleGambling.lastChecked = new Date();
        if (prediction && prediction.is_at_risk) {
          user.responsibleGambling.status = "at_risk";
          // Use the reason from the model as the risk factor
          user.responsibleGambling.riskFactors = [
            prediction.reason || "ML model flagged as at-risk",
          ];
          console.log(
            `⚠️  ML Model flagged user ${
              user.username
            } as 'at_risk'. Reason: ${user.responsibleGambling.riskFactors.join(
              ", "
            )}`
          );
        } else {
          user.responsibleGambling.status = "ok";
          user.responsibleGambling.riskFactors = [];
        }

        await user.save();
      } catch (mlError) {
        // This will give us a much more detailed network error message
        console.error(
          `❌ Error calling ML model for user ${user.username}:`,
          mlError.code || mlError.message
        );
      }
    }

    console.log("✅ ML-Powered analysis complete.");
  } catch (error) {
    console.error(
      "❌ An error occurred during the main analysis process:",
      error
    );
  } finally {
    await mongoose.disconnect();
    console.log("ℹ️ MongoDB disconnected.");
  }
}

analyzeUsers();
