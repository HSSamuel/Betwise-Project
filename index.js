const express = require("express");
const connectDB = require("./config/db"); // Assumes db.js is in a 'config' folder
require("dotenv").config(); // Loads environment variables from .env file

const app = express();

// Middleware to parse JSON request bodies
app.use(express.json());

// --- Route Definitions ---
// Mount authentication routes
app.use("/auth", require("./routes/authRoutes"));
// Mount game routes
app.use("/games", require("./routes/gameRoutes"));
// Mount betting routes
app.use("/bets", require("./routes/betRoutes"));
// Mount wallet routes
app.use("/wallet", require("./routes/walletRoutes"));
// Mount admin routes
app.use("/admin", require("./routes/adminRoutes"));
// Mount user profile routes (for email/password changes etc.)
app.use("/users", require("./routes/userRoutes")); // Added /users prefix for clarity

// Health check endpoint
app.get("/", (req, res) => {
  res.send("⚡️ Sports Betting API is up and running");
});

// --- Global 404 Handler for undefined routes ---
app.use((req, res) => {
  res.status(404).json({ msg: "Route not found" });
});

// --- Start Server ---
const startServer = async () => {
  try {
    // Connect to the database before starting the server
    await connectDB();
    const PORT = process.env.PORT || 5000; // Use port from .env or default to 5000
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    // Log error if database connection fails and exit
    console.error("❌ Failed to start server due to DB connection error:", err);
    process.exit(1);
  }
};

// Initialize server startup
startServer();

module.exports = app; // Export app for testing purposes
