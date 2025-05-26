const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Determine MongoDB URI based on environment (test or development/production)
    const dbUri =
      process.env.NODE_ENV === "test"
        ? process.env.MONGODB_TEST_URI // URI for the test database
        : process.env.MONGODB_URI; // URI for the main database

    // Check if the MongoDB URI is defined
    if (!dbUri) {
      console.error("MongoDB URI defined in environment variables.");
      process.exit(1); // Exit if URI is not found
    }

    // Connect to MongoDB
    await mongoose.connect(dbUri);

    // Log successful connection, showing the host for clarity
    const host = new URL(dbUri).host;
    console.log(`✅ Connected to MongoDB: ${host}`);
  } catch (err) {
    // Log any connection errors and exit the process
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
