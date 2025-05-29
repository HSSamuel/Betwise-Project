// THIS MUST BE THE VERY FIRST LINE
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const mongoose = require("mongoose");
const User = require("../models/User");

const dbUri = process.env.MONGODB_URI;

if (!dbUri) {
  console.error("Error: MONGODB_URI is not defined in your .env file.");
  process.exit(1);
}

const scriptUsername = process.argv[2]; // Renamed to avoid confusion if 'username' is used elsewhere

if (!scriptUsername) {
  console.error(
    "Please provide a username as an argument (node cli/checkAdmin.js <username>)"
  );
  process.exit(1);
}

mongoose
  .connect(dbUri)
  .then(async () => {
    // Use the 'scriptUsername' variable that holds the command line argument
    const user = await User.findOne({ username: scriptUsername });
    if (!user) {
      console.log(`User "${scriptUsername}" not found`);
    } else {
      console.log(
        `${user.username} is ${user.role === "admin" ? "" : "NOT "}an admin`
      );
    }
    mongoose.connection.close();
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    // If the error is the ReferenceError, it was within the .then() block before this fix.
  });
