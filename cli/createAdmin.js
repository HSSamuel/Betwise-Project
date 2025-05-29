require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs"); // Make sure bcryptjs is required if you create this file from scratch
const User = require("../models/User"); // Adjust path if User.js is elsewhere relative to cli/

const dbUri = process.env.MONGODB_URI;

if (!dbUri) {
  // This console.error will now use your logger if you've integrated it, otherwise plain console
  console.error(
    "Error: MONGODB_URI is not defined in your .env file. Please ensure it is set and the .env file is in the project root."
  );
  process.exit(1);
}

// Get the username, email, and password from the CLI arguments
const username = process.argv[2];
const email = process.argv[3];
const password = process.argv[4];

if (!username || !email || !password) {
  console.error(
    "❗ Usage: node cli/createAdmin.js <username> <email> <password>"
  ); // Adjusted path
  process.exit(1);
}

// Connect to MongoDB
mongoose
  .connect(dbUri) //
  .then(async () => {
    console.log("✅ MongoDB connected"); // Or logger.info
    await createAdminUser(username, email, password);
    mongoose.connection.close();
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err); // Or logger.error
    // The error you see is thrown here because dbUri is undefined.
    process.exit(1); // Exit if connection fails
  });

// Create and save the admin user (ensure bcrypt is available)
async function createAdminUser(username, email, password) {
  try {
    const existingUser = await User.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() },
      ],
    }); //

    if (existingUser) {
      // Corrected line for cli/createAdmin.js
      console.log(
        `❌ User "<span class="math-inline">\{username\}" or email "</span>{email}" already exists`
      ); //
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10); //

    const newUser = new User({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password: hashedPassword,
      role: "admin", // Set the role to 'admin'
      // Ensure your User model has defaults or you provide all required fields
      // For example, firstName and lastName are required in your User model
      firstName: "AdminFirstName", // Add default or get from args
      lastName: "AdminLastName", // Add default or get from args
      // state: "DefaultState" // if applicable
    });

    await newUser.save(); //
    console.log(`✅ Admin user "${username}" created successfully`); //
  } catch (error) {
    console.error("❌ Error creating admin user:", error); //
    if (error.name === "ValidationError") {
      console.error("Validation Errors:", error.errors);
    }
  }
}
