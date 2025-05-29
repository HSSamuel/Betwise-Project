require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const dbUri = process.env.MONGODB_URI;

if (!dbUri) {
  console.error(
    "Error: MONGODB_URI is not defined in your .env file. Please ensure it is set and the .env file is in the project root."
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const command = args[0];
const username = args[1];
const value = args[2];

if (!command || !username) {
  //
  console.error("Usage: node cli/userCLI.js <command> <username> [value]");
  process.exit(1);
}

mongoose
  .connect(dbUri)
  .then(async () => {
    console.log("✅ MongoDB connected for userCLI"); // Or logger.info
    // ... rest of the script logic from userCLI.js
    const user = await User.findOne({ username });

    if (!user && command !== "create") {
    
      console.log("❌ User not found");
      return mongoose.connection.close(); //
    }

    switch (
      command //
    ) {
      case "change-email": //
        if (!value) {
          console.log("Provide new email");
          break;
        } //
        user.email = value; //
        await user.save(); //
        console.log(`✅ Email updated to ${value}`); //
        break;

      case "change-username": //
        if (!value) {
          console.log("Provide new username");
          break;
        } //
        user.username = value; //
        await user.save(); //
        console.log(`✅ Username changed to ${value}`); //
        break;

      case "change-password": //
        if (!value) {
          console.log("Provide new password");
          break;
        } //
        user.password = await bcrypt.hash(value, 10); //
        await user.save(); //
        console.log("✅ Password updated"); //
        break;

      case "check-role": //
        console.log(`${user.username} is ${user.role}`); //
        break;

      case "promote": //
        user.role = "admin"; //
        await user.save(); //
        console.log(`✅ ${user.username} promoted to admin`); //
        break;

      case "demote": //
        user.role = "user"; //
        await user.save(); //
        console.log(`✅ ${user.username} demoted to user`); //
        break;

      case "delete": //
        await user.deleteOne(); //
        console.log(`🗑️ ${username} deleted`); //
        break;

      default: //
        console.log("Unknown command"); //
    }

    mongoose.connection.close(); //
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err); //
    process.exit(1);
  });
