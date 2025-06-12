// In: services/sportsDataService.js

const axios = require("axios");
const Game = require("../models/Game");

// This is now the single, main function that handles everything.
const fetchAndSyncGames = async (specificLeagueId = null) => {
  try {
    const apiKey = process.env.APIFOOTBALL_KEY;
    if (!apiKey) {
      throw new Error("APIFOOTBALL_KEY is not defined in your .env file.");
    }

    let leaguesToProcess = [];
    const seasonsToSync = [2025, 2026];

    if (specificLeagueId) {
      leaguesToProcess.push({
        id: specificLeagueId,
        name: `League ${specificLeagueId}`,
      });
    } else {
      leaguesToProcess = [
        { id: 39, name: "English Premier League" },
        { id: 140, name: "La Liga (Spain)" },
        { id: 135, name: "Serie A (Italy)" },
        { id: 78, name: "Bundesliga (Germany)" },
        { id: 253, name: "MLS (USA)" },
        { id: 61, name: "Ligue 1 (France)" },
        { id: 307, name: "Saudi Professional League" },
        { id: 203, name: "Süper Lig (Turkey)" },
        { id: 1, name: "World Cup" },
        { id: 4, name: "Africa Cup of Nations" },
        { id: 15, name: "Club World Cup" },
      ];
    }

    console.log(
      `-- Starting API sync for ${leaguesToProcess.length} league(s) across ${seasonsToSync.length} season(s) --`
    );

    for (const league of leaguesToProcess) {
      for (const season of seasonsToSync) {
        console.log(
          `ℹ️  Fetching data for ${league.name} (ID: ${league.id}), Season: ${season}...`
        );

        const apiUrl = `https://v3.football.api-sports.io/fixtures?league=${league.id}&season=${season}&status=NS`;
        const response = await axios.get(apiUrl, {
          headers: {
            "x-apisports-key": apiKey,
            "x-apisports-host": "v3.football.api-sports.io",
          },
        });

        const gamesFromApi = response.data.response;
        if (!gamesFromApi || gamesFromApi.length === 0) {
          console.log(
            `✅ No new upcoming games found for league ${league.id} in season ${season}.`
          );
          continue;
        }

        for (const apiGame of gamesFromApi) {
          // --- LOGIC TO CHECK FOR ODDS CHANGES ---

          // 1. Find the existing game in our database, if it exists.
          const existingGame = await Game.findOne({
            externalApiId: apiGame.fixture.id,
          });

          // 2. Map all the new data from the API.
          const gameData = {
            homeTeam: apiGame.teams.home.name,
            awayTeam: apiGame.teams.away.name,
            homeTeamLogo: apiGame.teams.home.logo,
            awayTeamLogo: apiGame.teams.away.logo,
            matchDate: new Date(apiGame.fixture.date),
            league: `${apiGame.league.name} ${apiGame.league.season}`,
            status: "upcoming",
            externalApiId: apiGame.fixture.id,
            // For now, we use placeholder odds. In a real app, this would be another API call.
            odds: { home: 2.0, away: 3.5, draw: 3.25 },
            // Preserve the existing odds history array if the game already exists.
            oddsHistory: existingGame ? existingGame.oddsHistory : [],
          };

          // 3. Compare the new odds with the old odds.
          if (
            existingGame &&
            (existingGame.odds.home !== gameData.odds.home ||
              existingGame.odds.away !== gameData.odds.away ||
              existingGame.odds.draw !== gameData.odds.draw)
          ) {
            console.log(
              `- Odds changed for game ${existingGame.homeTeam} vs ${existingGame.awayTeam}. Archiving old odds.`
            );
            // If they are different, push the old odds into the history array.
            gameData.oddsHistory.push({ odds: existingGame.odds });
          }

          // 4. Finally, update the database with the new data.
          await Game.findOneAndUpdate(
            { externalApiId: gameData.externalApiId },
            { $set: gameData },
            { new: true, upsert: true, setDefaultsOnInsert: true }
          );
        }
        console.log(
          `✅ Sync for league ${league.id}, season ${season} complete. Processed ${gamesFromApi.length} fixtures.`
        );
      }
    }
    console.log("-- Finished API sync --");
  } catch (error) {
    console.error(
      "❌ Error syncing data from API-Football:",
      error.response ? error.response.data : error.message
    );
  }
};

module.exports = { fetchAndSyncGames };
// This service now handles fetching and syncing game data from the API.
