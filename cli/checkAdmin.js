const mongoose = require("mongoose");
const User = require("../models/User");

const dbUri =
  process.env.MONGODB_URI ||
  "mongodb+srv://HSSamuel:Iamgreatness12345..@cluster0.6jkfcgy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const username = process.argv[2];

if (!username) {
  console.error("Please provide a username as an argument");
  process.exit(1);
}

mongoose
  .connect(dbUri)
  .then(async () => {
    const user = await User.findOne({ username });
    if (!user) {
      console.log("User not found");
    } else {
      console.log(
        `${username} is ${user.role === "admin" ? "" : "NOT "}an admin`
      );
    }
    mongoose.connection.close();
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });
