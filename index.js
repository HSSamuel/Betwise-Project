require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
require("./config/passport-setup");
const cron = require("node-cron");
const mongoose = require("mongoose"); //
const { fetchAndSyncGames } = require("./services/sportsDataService");
const { analyzePlatformRisk } = require("./scripts/monitorPlatformRisk");

const app = express();
app.set("json spaces", 2);

// --- Essential Middleware ---
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === "development" ? "dev" : "combined"));

// --- Rate Limiting Setup ---
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    msg: "Too many authentication attempts from this IP, please try again after 15 minutes.",
  },
});

app.use("/api", generalApiLimiter);

// --- Route Definitions (with API Versioning) ---
const apiVersion = "/api/v1";

app.use(`${apiVersion}/auth`, authLimiter, require("./routes/authRoutes"));
app.use(`${apiVersion}/games`, require("./routes/gameRoutes"));
app.use(`${apiVersion}/bets`, require("./routes/betRoutes"));
app.use(`${apiVersion}/wallet`, require("./routes/walletRoutes"));
app.use(`${apiVersion}/admin`, require("./routes/adminRoutes"));
app.use(`${apiVersion}/users`, require("./routes/userRoutes"));
app.use(`${apiVersion}/ai`, require("./routes/aiRoutes"));

// --- Root and Info Routes ---
app.get("/", (req, res) => {
  res.send(
    "Welcome to BetWise API! Your ultimate destination for sports betting."
  );
});
app.get("/welcome", (req, res) => {
  res.status(200).json({
    message: "⚡️ Sports Betting API is up and running.",
    timestamp: new Date().toISOString(),
    location: "Nigeria",
  });
});
app.get("/data-deletion-instructions", (req, res) => {
  res.status(200).send(`...HTML content...`); // Omitted for brevity
});

// --- Error Handling Middleware ---
app.use((req, res, next) => {
  const error = new Error(`Route not found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    msg: err.message || "An unexpected internal server error occurred.",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// --- Server Startup ---
const startServer = async () => {
  try {
    await connectDB();
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(
        `🚀 Server running on port ${PORT} in ${
          process.env.NODE_ENV || "development"
        } mode.`
      );

      // Cron job for syncing games (every 30 mins)
      cron.schedule("*/30 * * * *", () => {
        console.log("🕒 Running scheduled task to sync games...");
        fetchAndSyncGames();
      });
      console.log(
        "✅ Game sync task has been scheduled to run every 30 minutes."
      );

      // Cron job for Risk Monitoring (every 5 mins)
      cron.schedule("*/5 * * * *", async () => {
        console.log("🤖 Running scheduled task to monitor platform risk...");
        try {
          // This task now reuses the main database connection, which is more efficient.
          await analyzePlatformRisk();
        } catch (error) {
          console.error(
            "❌ Error during scheduled risk analysis:",
            error.message
          );
        }
      });
      console.log("✅ Platform risk monitor scheduled to run every 5 minutes.");
    });
  } catch (dbConnectionError) {
    console.error(
      "❌ Failed to connect to database. Server not started.",
      dbConnectionError.message
    );
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== "test") {
  startServer();
}

module.exports = app;
