const mongoose = require("mongoose");

const connectDB = async () => {
  // Determine MongoDB URI based on environment
  const dbUri =
    process.env.NODE_ENV === "test"
      ? process.env.MONGODB_TEST_URI
      : process.env.MONGODB_URI;

  // Check if the MongoDB URI is defined
  if (!dbUri) {
    console.error(
      "Error: MongoDB URI is not defined. Please set MONGODB_URI (and MONGODB_TEST_URI for the test environment) in your .env file."
    );
    process.exit(1); // Exit if URI is not found
  }

  try {
    // Connect to MongoDB
    await mongoose.connect(dbUri);

    // Log successful connection, showing the host for clarity
    // This 'connected' event handler below will also cover this,
    // but an initial log here after await is also fine.
    // const host = new URL(dbUri).host;
    // console.log(`✅ Initial connection to MongoDB successful: ${host}`);
  } catch (err) {
    // Log any initial connection errors and exit the process
    console.error("❌ Initial MongoDB connection error:", err.message);
    process.exit(1);
  }
};

// Mongoose connection event listeners
// These listeners are attached to the default Mongoose connection object.

// Successfully connected
mongoose.connection.on("connected", () => {
  // Determine URI again for logging host, or pass it somehow if needed,
  // for now, just a generic message.
  const dbUri =
    process.env.NODE_ENV === "test"
      ? process.env.MONGODB_TEST_URI
      : process.env.MONGODB_URI;
  if (dbUri) {
    const host = new URL(dbUri).host;
    console.log(`✅ MongoDB connected: ${host}`);
  } else {
    console.log("✅ MongoDB connected."); // Fallback message
  }
});

// Connection throws an error
mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error after initial connection:", err);
  // Depending on the application's needs, you might not want to process.exit(1) here,
  // as Mongoose might attempt to reconnect automatically.
  // However, for critical errors, exiting might be appropriate.
});

// Connection is disconnected
mongoose.connection.on("disconnected", () => {
  console.warn("ℹ️ MongoDB disconnected.");
});

// Mongoose reconnected to the database
mongoose.connection.on("reconnected", () => {
  console.log("✅ MongoDB reconnected.");
});

// If the Node process ends, close the Mongoose connection
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log(
    "ℹ️ MongoDB connection disconnected through app termination (SIGINT)."
  );
  process.exit(0);
});

module.exports = connectDB;
