// Ensure dotenv is configured correctly, assuming .env is in the project root
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const mongoose = require("mongoose");
const bcryptjs = require("bcryptjs"); // Using bcryptjs for consistency with package.json
const User = require("../models/User");
const Transaction = require("../models/Transaction");

const dbUri = process.env.MONGODB_URI;
let exitCode = 0; // To manage exit code based on success/failure

async function run() {
  console.log("🚀 Starting transaction simulation script...");

  if (!dbUri) {
    console.error(
      "❌ Error: MONGODB_URI is not defined. Please set it in your .env file."
    );
    exitCode = 1;
    return; // Exit run function, finally will handle disconnect if ever connected
  }

  try {
    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(dbUri);
    console.log("✅ Successfully connected to MongoDB.");

    const username = "testsimuser"; // Using a distinct username for simulation
    const email = `${username}@example.com`;
    let user = await User.findOne({ username: username.toLowerCase() });

    if (!user) {
      console.log(`ℹ️ User "${username}" not found. Creating a new one...`);
      const plainPassword = "testpassword123";
      const hashedPassword = await bcryptjs.hash(plainPassword, 10); // Using bcryptjs

      user = new User({
        username: username.toLowerCase(),
        email: email.toLowerCase(), // Email is required and should be unique
        password: hashedPassword,
        firstName: "TestSim", // Added required field
        lastName: "User", // Added required field
        walletBalance: 1000.0, // Initial balance with two decimals
        // state: "Simulated" // Optional
      });
      await user.save();
      console.log(
        `👤 User "${
          user.username
        }" created successfully with initial balance: ${user.walletBalance.toFixed(
          2
        )}.`
      );
    } else {
      console.log(
        `👤 Using existing user: "${
          user.username
        }" with balance: ${user.walletBalance.toFixed(2)}.`
      );
    }

    // --- Simulate Top-up ---
    const topUpAmount = 500.0;
    user.walletBalance += topUpAmount;
    user.walletBalance = parseFloat(user.walletBalance.toFixed(2)); // Ensure precision
    await user.save();
    await new Transaction({
      user: user._id,
      type: "topup",
      amount: topUpAmount,
      balanceAfter: user.walletBalance,
      description: `Simulated top-up of ${topUpAmount.toFixed(2)}`,
    }).save();
    console.log(
      `💰 Simulated top-up of ${topUpAmount.toFixed(
        2
      )}. New balance: ${user.walletBalance.toFixed(2)}`
    );

    // --- Simulate Bet ---
    const betAmount = 200.0;
    if (user.walletBalance >= betAmount) {
      user.walletBalance -= betAmount;
      user.walletBalance = parseFloat(user.walletBalance.toFixed(2)); // Ensure precision
      await user.save();
      await new Transaction({
        user: user._id,
        type: "bet",
        amount: -betAmount, // Bets are negative amounts
        balanceAfter: user.walletBalance,
        description: `Simulated bet of ${betAmount.toFixed(2)}`,
        // Note: For a full simulation, you might want to create a dummy Game and Bet document and link them.
      }).save();
      console.log(
        `🎲 Simulated bet of ${betAmount.toFixed(
          2
        )}. New balance: ${user.walletBalance.toFixed(2)}`
      );
    } else {
      console.warn(
        `⚠️ Could not simulate bet of ${betAmount.toFixed(
          2
        )}: insufficient balance for user "${user.username}".`
      );
    }

    // --- Simulate Win ---
    const winAmount = 400.0;
    user.walletBalance += winAmount;
    user.walletBalance = parseFloat(user.walletBalance.toFixed(2)); // Ensure precision
    await user.save();
    await new Transaction({
      user: user._id,
      type: "win",
      amount: winAmount,
      balanceAfter: user.walletBalance,
      description: `Simulated win payout of ${winAmount.toFixed(2)}`,
      // Note: Link to the corresponding bet if it was simulated.
    }).save();
    console.log(
      `🏆 Simulated win payout of ${winAmount.toFixed(
        2
      )}. New balance: ${user.walletBalance.toFixed(2)}`
    );

    console.log("✅ Simulation completed successfully.");
  } catch (error) {
    console.error("❌ Error during simulation:", error.message);
    if (error.name === "ValidationError") {
      for (const field in error.errors) {
        console.error(
          `  Validation Error for ${field}: ${error.errors[field].message}`
        );
      }
    } else if (error.code === 11000) {
      // Handle duplicate key error for email/username
      console.error(
        `  MongoDB Duplicate Key Error: A user with these details might already exist. Error Code: ${error.code}`
      );
    }
    exitCode = 1; // Set exit code to indicate failure
  } finally {
    if (mongoose.connection.readyState === 1) {
      // 1 for connected
      try {
        await mongoose.disconnect();
        console.log("ℹ️ MongoDB disconnected.");
      } catch (disconnectError) {
        console.error(
          "❌ Error disconnecting from MongoDB:",
          disconnectError.message
        );
        exitCode = 1; // Indicate error during disconnect as well
      }
    }
    console.log(`🏁 Simulation script finished with exit code ${exitCode}.`);
    process.exit(exitCode); // Exit with the determined code
  }
}

run();
