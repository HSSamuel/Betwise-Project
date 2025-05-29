// scripts/populateMissingInfo.js
require("dotenv").config({ path: "../.env" }); // Adjust path to .env if needed
const mongoose = require("mongoose");
const User = require("../models/User"); // Adjust path if needed

const dbUri = process.env.MONGODB_URI;

const usernameToUpdate = process.argv[2];
const firstName = process.argv[3];
const lastName = process.argv[4];
const email = process.argv[5];

if (!usernameToUpdate || !firstName || !lastName || !email) {
  console.error(
    "Usage: node scripts/populateMissingInfo.js <username> <firstName> <lastName> <email>"
  );
  process.exit(1);
}

mongoose
  .connect(dbUri)
  .then(async () => {
    console.log("✅ MongoDB connected");
    const user = await User.findOne({ username: usernameToUpdate });

    if (!user) {
      console.log(`❌ User "${usernameToUpdate}" not found.`);
      mongoose.connection.close();
      return;
    }

    user.firstName = firstName;
    user.lastName = lastName;
    user.email = email;
    // user.state = "YourDefaultState"; // Optionally set a default state if needed

    try {
      await user.save();
      console.log(
        `✅ User "${usernameToUpdate}" updated successfully with name and email.`
      );
    } catch (validationError) {
      console.error(
        `❌ Error saving user "${usernameToUpdate}":`,
        validationError.message
      );
    }
    mongoose.connection.close();
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });
