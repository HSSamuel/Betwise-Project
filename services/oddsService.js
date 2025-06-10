// In: services/oddsService.js

const rankings = require("./team-rankings.json");

const BASE_ODDS = 5.0; // The highest possible odds for a massive underdog
const RANKING_SENSITIVITY = 0.05; // How much each ranking point affects the odds

/**
 * Generates betting odds for a game based on team power rankings.
 * @param {string} homeTeamName - The name of the home team.
 * @param {string} awayTeamName - The name of the away team.
 * @returns {object} An object containing home, away, and draw odds.
 */
const generateOddsForGame = (homeTeamName, awayTeamName) => {
  console.log(`- Generating odds for ${homeTeamName} vs ${awayTeamName}...`);

  const homeRank =
    rankings.teams[homeTeamName.toLowerCase()] || rankings.default_ranking;
  const awayRank =
    rankings.teams[awayTeamName.toLowerCase()] || rankings.default_ranking;

  // The core logic: the difference in rank adjusts the odds.
  const rankDifference = homeRank - awayRank;

  let homeOdds = BASE_ODDS - rankDifference * RANKING_SENSITIVITY;
  let awayOdds = BASE_ODDS + rankDifference * RANKING_SENSITIVITY;

  // The draw odds are lower when teams are closely matched.
  const drawOdds = 2.5 + Math.abs(rankDifference) * (RANKING_SENSITIVITY / 2);

  // Ensure odds never fall below the minimum of 1.01
  homeOdds = Math.max(1.01, homeOdds);
  awayOdds = Math.max(1.01, awayOdds);

  const finalOdds = {
    home: parseFloat(homeOdds.toFixed(2)),
    away: parseFloat(awayOdds.toFixed(2)),
    draw: parseFloat(drawOdds.toFixed(2)),
  };

  console.log(`- Generated Odds:`, finalOdds);
  return finalOdds;
};

module.exports = { generateOddsForGame };
// This module provides a function to generate betting odds based on team rankings.