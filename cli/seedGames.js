// In: cli/seedGames.js

require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const mongoose = require("mongoose");
const Game = require("../models/Game"); // Adjust path to your Game model

const dbUri = process.env.MONGODB_URI;

// --- Predefined Game Data ---
// We set match dates relative to the current date to ensure they are always in the future.
const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const inTwoDays = new Date(today);
inTwoDays.setDate(today.getDate() + 2);

const sampleGames = [
  {
    homeTeam: "Manchester United",
    awayTeam: "Chelsea",
    odds: { home: 2.5, away: 2.8, draw: 3.4 },
    league: "English Premier League",
    matchDate: tomorrow.setHours(16, 0, 0), // Tomorrow at 4:00 PM
    status: "upcoming",
  },
  {
    homeTeam: "Real Madrid",
    awayTeam: "Barcelona",
    odds: { home: 1.9, away: 3.5, draw: 3.8 },
    league: "La Liga",
    matchDate: tomorrow.setHours(20, 0, 0), // Tomorrow at 8:00 PM
    status: "upcoming",
  },
  {
    homeTeam: "Bayern Munich",
    awayTeam: "Borussia Dortmund",
    odds: { home: 1.5, away: 5.5, draw: 4.5 },
    league: "Bundesliga",
    matchDate: inTwoDays.setHours(14, 30, 0), // In two days at 2:30 PM
    status: "upcoming",
  },
  {
    homeTeam: "Kano Pillars",
    awayTeam: "Enyimba FC",
    odds: { home: 2.2, away: 3.1, draw: 2.9 },
    league: "NPFL",
    matchDate: inTwoDays.setHours(16, 0, 0), // In two days at 4:00 PM
    status: "upcoming",
  },
];

const seedDB = async () => {
  if (!dbUri) {
    console.error("❌ Error: MONGODB_URI is not defined in your .env file.");
    process.exit(1);
  }

  try {
    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(dbUri);
    console.log("✅ MongoDB connected successfully.");

    console.log("🔥 Clearing existing game data...");
    await Game.deleteMany({});
    console.log("✅ Existing games cleared.");

    console.log("🌱 Seeding new games...");
    await Game.insertMany(sampleGames);
    console.log(`✅ Successfully seeded ${sampleGames.length} new games.`);
  } catch (err) {
    console.error("❌ Error during database seeding:", err);
  } finally {
    // Always close the connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("ℹ️ MongoDB connection closed.");
    }
  }
};

// Run the seeding function
seedDB();
// Handle process termination gracefully
