const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const dbUri =
  process.env.MONGODB_URI ||
  "mongodb+srv://HSSamuel:Iamgreatness12345..@cluster0.6jkfcgy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const currentUsername = process.argv[2]; // Existing username
const newUsername = process.argv[3]; // New username (optional)
const newPassword = process.argv[4]; // New password (optional)

if (!currentUsername || (!newUsername && !newPassword)) {
  console.error(
    "Usage: node updateUser.js <currentUsername> [newUsername] [newPassword]"
  );
  process.exit(1);
}

mongoose
  .connect(dbUri)
  .then(async () => {
    const user = await User.findOne({ username: currentUsername });
    if (!user) {
      console.log("User not found");
      process.exit(1);
    }

    if (newUsername) {
      user.username = newUsername;
      console.log(`✔ Username updated to "${newUsername}"`);
    }

    if (newPassword) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
      console.log(`✔ Password updated`);
    }

    await user.save();
    console.log("✅ User update successful");
    mongoose.connection.close();
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });
