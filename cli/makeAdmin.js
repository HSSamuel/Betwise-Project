require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const mongoose = require("mongoose");
const User = require("../models/User"); // Adjust path if User model is elsewhere

const dbUri = process.env.MONGODB_URI;

if (!dbUri) {
  console.error(
    "❌ Error: MONGODB_URI is not defined. Please ensure it is set in your .env file."
  );
  process.exit(1);
}

const inputUsername = process.argv[2];

if (!inputUsername) {
  console.error(
    "❗ Please provide a username as an argument (e.g., node cli/makeAdmin.js <username>)"
  );
  process.exit(1);
}

async function main() {
  try {
    console.log(`ℹ️ Attempting to make user "${inputUsername}" an admin.`);
    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(dbUri);
    console.log("✅ MongoDB connected successfully.");

    await makeUserAdmin(inputUsername);
  } catch (error) {
    // This catch block is primarily for errors during the mongoose.connect phase
    // or other unexpected errors in main before makeUserAdmin is deeply involved.
    console.error(
      "❌ An unexpected error occurred in the main process:",
      error.message
    );
  } finally {
    if (mongoose.connection.readyState === 1) {
      // 1 for connected
      await mongoose.connection.close();
      console.log("ℹ️ MongoDB connection closed.");
    }
    // The script will exit naturally after operations or via process.exit(1) in error cases.
  }
}

async function makeUserAdmin(username) {
  try {
    // Convert input username to lowercase for case-insensitive comparison
    const usernameToQuery = username.toLowerCase();
    const user = await User.findOne({ username: usernameToQuery });

    if (!user) {
      console.log(
        `❌ User "${username}" (queried as "${usernameToQuery}") not found.`
      );
      return;
    }

    if (user.role === "admin") {
      console.log(`ℹ️ User "${user.username}" is already an admin.`);
    } else {
      user.role = "admin";
      await user.save();
      console.log(
        `✅ User "${user.username}" has been successfully promoted to admin.`
      );
    }
  } catch (error) {
    console.error(
      `❌ Error promoting user "${username}" to admin:`,
      error.message
    );
    if (error.name === "ValidationError") {
      for (const field in error.errors) {
        console.error(`  - ${error.errors[field].message}`);
      }
    }
    // If an error occurs here, the connection will still be closed by the finally block in main().
  }
}

main();
