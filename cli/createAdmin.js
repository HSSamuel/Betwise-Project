const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User"); // Adjust path if needed

const dbUri =
  process.env.MONGODB_URI ||
  "mongodb+srv://HSSamuel:Iamgreatness12345..@cluster0.6jkfcgy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Get the username, email, and password from the CLI arguments
const username = process.argv[2];
const email = process.argv[3];
const password = process.argv[4];

if (!username || !email || !password) {
  console.error("❗ Usage: node createAdmin.js <username> <email> <password>");
  process.exit(1);
}

// Connect to MongoDB
mongoose
  .connect(dbUri)
  .then(async () => {
    console.log("✅ MongoDB connected");
    await createAdminUser(username, email, password);
    mongoose.connection.close();
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// Create and save the admin user
async function createAdminUser(username, email, password) {
  try {
    const existingUser = await User.findOne({ username });

    if (existingUser) {
      console.log(`❌ User "${username}" already exists`);
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the new admin user
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role: "admin", // Set the role to 'admin'
    });

    await newUser.save();
    console.log(`✅ Admin user "${username}" created successfully`);
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
  }
}
