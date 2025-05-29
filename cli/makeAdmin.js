require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const mongoose = require("mongoose");
const User = require("../models/User"); // Adjust path if needed

// MongoDB connection URI
const dbUri = process.env.MONGODB_URI; // This should now be correctly populated

if (!dbUri) {
  console.error(
    "Error: MONGODB_URI is not defined in your .env file. Please ensure it is set and the .env file is in the project root."
  );
  process.exit(1);
}

// Get username from CLI argument
const username = process.argv[2]; //

if (!username) {
  console.error("❗ Please provide a username as an argument"); //
  process.exit(1); //
}

// Connect to MongoDB
mongoose
  .connect(dbUri) //
  .then(async () => {
    console.log("✅ MongoDB connected"); //
    await makeUserAdmin(username);
    mongoose.connection.close(); //
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err); //
    process.exit(1); //
  });

// Promote user to admin
async function makeUserAdmin(username) {
  //
  try {
    const user = await User.findOne({ username }); //

    if (!user) {
      console.log(`❌ User "${username}" not found`); //
      return;
    }

    if (user.role === "admin") {
      //
      console.log(`ℹ️ "${username}" is already an admin`); //
    } else {
      user.role = "admin"; //
      await user.save(); //
      console.log(`✅ "${username}" has been promoted to admin`); //
    }
  } catch (error) {
    console.error("❌ Error promoting user:", error); //
  }
}
