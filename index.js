const express = require("express");
const connectDB = require("./config/db");
require("dotenv").config();

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use("/auth", require("./routes/authRoutes"));
app.use("/games", require("./routes/gameRoutes"));
app.use("/bets", require("./routes/betRoutes"));
app.use("/wallet", require("./routes/walletRoutes"));
app.use("/admin", require("./routes/adminRoutes"));

// Health check endpoint
app.get("/", (req, res) => {
  res.send("⚡️ Sports Betting API is up and running");
});

// Start server after DB connects
const startServer = async () => {
  try {
    await connectDB();
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to connect to DB:", err);
    process.exit(1);
  }
};

startServer();

module.exports = app; // for testing purposes
