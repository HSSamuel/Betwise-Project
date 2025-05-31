require("dotenv").config(); // Loads environment variables from .env file
const express = require("express");
const helmet = require("helmet"); // For security headers
const morgan = require("morgan"); // For request logging
const cors = require("cors"); // For Cross-Origin Resource Sharing
const connectDB = require("./config/db");

const app = express();

// --- Essential Middleware ---
app.use(helmet()); // Set various security HTTP headers

// CORS Configuration (adjust as needed for your frontend's origin)
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:8000", // Allow your frontend origin
  optionsSuccessStatus: 200, // For legacy browser compatibility
};
app.use(cors(corsOptions));

app.use(express.json()); // Middleware to parse JSON request bodies

// HTTP request logger middleware (use 'dev' for development, 'combined' for production)
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined")); // More detailed logging for production
}

// --- Route Definitions ---
app.use("/auth", require("./routes/authRoutes"));
app.use("/games", require("./routes/gameRoutes"));
app.use("/bets", require("./routes/betRoutes"));
app.use("/wallet", require("./routes/walletRoutes"));
app.use("/admin", require("./routes/adminRoutes"));
app.use("/users", require("./routes/userRoutes"));

// Health check endpoint
app.get("/", (req, res) => {
  res.send("⚡️ Sports Betting API is up and running");
});

// --- Error Handling Middleware ---

// Handle 404 Not Found (should be after all valid routes)
app.use((req, res, next) => {
  const error = new Error(`Route not found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error); // Pass to the global error handler
});

// Global Error Handler (should be the LAST middleware)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // console.error("Global Error Handler:", err); // Use a proper logger for the full error object/stack

  const statusCode = err.statusCode || 500;
  const message =
    err.message || "An unexpected internal server error occurred.";

  // For validation errors from express-validator, err.errors might exist
  // This could be handled more specifically if needed, but for now, use message.

  res.status(statusCode).json({
    msg: message, // Use msg to be consistent with some of your existing error responses
    // Optionally include stack trace in development for debugging
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    ...(err.errors && { errors: err.errors }), // Include validation errors if present
  });
});

// --- Start Server ---
const startServer = async () => {
  try {
    await connectDB();
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      // Replace with a proper logger:
      console.log(
        `🚀 Server running on port ${PORT} in ${
          process.env.NODE_ENV || "development"
        } mode.`
      );
    });
  } catch (dbConnectionError) {
    // Replace with a proper logger:
    console.error(
      "❌ Failed to connect to database. Server not started.",
      dbConnectionError.message
    );
    process.exit(1);
  }
};

// Initialize server startup
if (process.env.NODE_ENV !== "test") {
  // Do not start server automatically during tests
  startServer();
}

module.exports = app; // Export app for testing purposes
