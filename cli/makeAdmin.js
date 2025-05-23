const mongoose = require("mongoose");
const User = require("../models/User"); // Adjust path if needed

// MongoDB connection URI
const dbUri =
  process.env.MONGODB_URI ||
  "mongodb+srv://HSSamuel:Iamgreatness12345..@cluster0.6jkfcgy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Get username from CLI argument
const username = process.argv[2];

if (!username) {
  console.error("❗ Please provide a username as an argument");
  process.exit(1);
}

// Connect to MongoDB
mongoose
  .connect(dbUri)
  .then(async () => {
    console.log("✅ MongoDB connected");
    await makeUserAdmin(username);
    mongoose.connection.close();
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// Promote user to admin
async function makeUserAdmin(username) {
  try {
    const user = await User.findOne({ username });

    if (!user) {
      console.log(`❌ User "${username}" not found`);
      return;
    }

    if (user.role === "admin") {
      console.log(`ℹ️ "${username}" is already an admin`);
    } else {
      user.role = "admin";
      await user.save();
      console.log(`✅ "${username}" has been promoted to admin`);
    }
  } catch (error) {
    console.error("❌ Error promoting user:", error);
  }
}
// This code connects to a MongoDB database using Mongoose and promotes a user to admin status. It takes the username as a command line argument, fetches the user from the database, and updates their role to "admin" if they are not already an admin. If the user is not found, it logs "User not found". Finally, it closes the database connection.
