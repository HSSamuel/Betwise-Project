require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

const dbUri = process.env.MONGODB_URI;

async function run() {
  try {
    await mongoose.connect(dbUri);
    console.log("✅ Connected to MongoDB");

    // Create or find user
    const username = "testuser";
    let user = await User.findOne({ username });

    if (!user) {
      const plainPassword = "testpassword123"; // set your test password here
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

      user = new User({
        username,
        password: hashedPassword,
        walletBalance: 1000,
      });
      await user.save();
      console.log(`👤 Created user: ${username} with hashed password`);
    }

    // Simulate top-up
    user.walletBalance += 500;
    await user.save();
    await new Transaction({
      user: user._id,
      type: "topup",
      amount: 500,
      balanceAfter: user.walletBalance,
    }).save();
    console.log("💰 Simulated top-up of 500");

    // Simulate bet
    user.walletBalance -= 200;
    await user.save();
    await new Transaction({
      user: user._id,
      type: "bet",
      amount: -200,
      balanceAfter: user.walletBalance,
    }).save();
    console.log("🎲 Simulated bet of 200");

    // Simulate win
    user.walletBalance += 400;
    await user.save();
    await new Transaction({
      user: user._id,
      type: "win",
      amount: 400,
      balanceAfter: user.walletBalance,
    }).save();
    console.log("🏆 Simulated win payout of 400");

    await mongoose.disconnect();
    console.log("✅ Simulation complete and MongoDB disconnected");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

run();
// This script connects to a MongoDB database, creates a test user if it doesn't exist, and simulates a series of transactions (top-up, bet, win) for that user. It uses Mongoose for database operations and bcrypt for password hashing. After the simulation, it disconnects from the database.