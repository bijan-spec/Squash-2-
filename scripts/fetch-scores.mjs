#!/usr/bin/env node

/**
 * Fetch live scores from Club Locker API for CSA Club Nationals 2026
 *
 * Uses the undocumented Club Locker / US Squash API:
 *   https://api.ussquash.com/resources/res/trn/live_matrix?date=YYYY-MM-DD&tournamentId=ID
 *
 * Run manually:   node scripts/fetch-scores.mjs
 * Debug mode:     node scripts/fetch-scores.mjs --debug
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DATA_JS_PATH = resolve(ROOT, "data.js");
const DATA_JSON_PATH = resolve(ROOT, "data.json");
const DEBUG = process.argv.includes("--debug");

// ── Config ──────────────────────────────────────────────────────────
const CONFIG = {
  tournamentId: 18567,
  tournamentDates: ["2026-02-13", "2026-02-14", "2026-02-15"],
  teamSearchTerms: [
    "washington university",
    "washu",
    "wash u",
    "wash. u",
    "wustl",
  ],
  featuredPlayer: "James Sabet",
  featuredPlayerSearch: ["sabet", "james sabet", "j. sabet", "j sabet"],
  apiBase: "https://api.ussquash.com/resources",
  requestTimeout: 15000,
};

// ── Helpers ─────────────────────────────────────────────────────────
function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function warn(...args) {
  console.warn(`[${new Date().toISOString()}] WARN:`, ...args);
}

function isWashU(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  return CONFIG.teamSearchTerms.some((t) => lower.includes(t));
}

function isFeaturedPlayer(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  return CONFIG.featuredPlayerSearch.some((t) => lower.includes(t));
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function friendlyDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function dayLabel(dateStr) {
  const idx = CONFIG.tournamentDates.indexOf(dateStr);
  if (idx === -1) return dateStr;
  return `Day ${idx + 1}`;
}

// ── API Fetching ────────────────────────────────────────────────────
async function apiFetch(url) {
  log(`Fetching: ${url}`);
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "WashU-Squash-Tracker/1.0",
    },
    signal: AbortSignal.timeout(CONFIG.requestTimeout),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }
  return res.json();
}

async function fetchLiveMatrix(date) {
  const url = `${CONFIG.apiBase}/res/trn/live_matrix?date=${date}&tournamentId=${CONFIG.tournamentId}`;
  return apiFetch(url);
}

async function fetchTournamentInfo() {
  // Try to get tournament details from the tournaments list
  const url = `${CONFIG.apiBase}/tournaments?TopRecords=50&ngbId=10000&OrganizerType=1&Sanctioned=1&Status=1`;
  try {
    const data = await apiFetch(url);
    if (Array.isArray(data)) {
      const found = data.find(
        (t) =>
          t.TournamentID === CONFIG.tournamentId ||
          (t.TournamentName && t.TournamentName.toLowerCase().includes("club"))
      );
      if (found) return found;
    }
  } catch (e) {
    warn("Could not fetch tournament list:", e.message);
  }
  // Also try completed tournaments
  try {
    const url2 = `${CONFIG.apiBase}/tournaments?TopRecords=50&ngbId=10000&OrganizerType=1&Sanctioned=1&Status=3`;
    const data = await apiFetch(url2);
    if (Array.isArray(data)) {
      const found = data.find(
        (t) => t.TournamentID === CONFIG.tournamentId
      );
      if (found) return found;
    }
  } catch (e) {
    warn("Could not fetch completed tournaments:", e.message);
  }
  return null;
}

// ── Data Extraction ─────────────────────────────────────────────────
// The live_matrix response format is not fully known.
// We try multiple common field-name patterns to extract team matches.
function extractTeamMatches(apiData, date) {
  if (!apiData) return [];

  if (DEBUG) {
    log("Raw API response structure:", JSON.stringify(apiData, null, 2).substring(0, 3000));
  }

  const matches = [];
  const items = normalizeToArray(apiData);

  for (const item of items) {
    // Try to identify team match objects
    const teamMatch = tryExtractTeamMatch(item, date);
    if (teamMatch) {
      matches.push(teamMatch);
      continue;
    }

    // If the item has nested arrays, recurse into them
    for (const key of Object.keys(item)) {
      if (Array.isArray(item[key])) {
        for (const sub of item[key]) {
          if (typeof sub === "object" && sub !== null) {
            const tm = tryExtractTeamMatch(sub, date);
            if (tm) matches.push(tm);
          }
        }
      }
    }
  }

  return matches;
}

function normalizeToArray(data) {
  if (Array.isArray(data)) return data;
  if (typeof data === "object" && data !== null) {
    // Maybe the response is { matches: [...] } or { data: [...] } etc.
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key])) return data[key];
    }
    return [data];
  }
  return [];
}

function tryExtractTeamMatch(obj, date) {
  if (!obj || typeof obj !== "object") return null;

  // Look for team names in various possible field names
  const teamFields = [
    "Team1Name", "Team2Name",
    "team1Name", "team2Name",
    "HomeTeam", "AwayTeam",
    "homeTeam", "awayTeam",
    "TeamA", "TeamB",
    "team_a", "team_b",
    "Team1", "Team2",
    "team1", "team2",
  ];

  let team1 = null;
  let team2 = null;
  let team1Key = null;
  let team2Key = null;

  for (let i = 0; i < teamFields.length; i += 2) {
    const k1 = teamFields[i];
    const k2 = teamFields[i + 1];
    if (obj[k1] || obj[k2]) {
      team1 = findStringValue(obj, k1);
      team2 = findStringValue(obj, k2);
      team1Key = k1;
      team2Key = k2;
      break;
    }
  }

  // Also check generic name fields
  if (!team1) {
    const nameKeys = Object.keys(obj).filter(
      (k) =>
        typeof obj[k] === "string" &&
        (k.toLowerCase().includes("team") || k.toLowerCase().includes("name"))
    );
    if (nameKeys.length >= 2) {
      team1 = obj[nameKeys[0]];
      team2 = obj[nameKeys[1]];
    }
  }

  if (!team1 && !team2) return null;

  // Check if WashU is involved
  const washuIsTeam1 = isWashU(team1);
  const washuIsTeam2 = isWashU(team2);
  if (!washuIsTeam1 && !washuIsTeam2) return null;

  const washuTeam = washuIsTeam1 ? team1 : team2;
  const opponent = washuIsTeam1 ? team2 : team1;

  // Try to find scores
  const score1 = findNumericValue(obj, [
    "Team1Score", "team1Score", "HomeScore", "homeScore",
    "ScoreA", "score_a", "Score1", "score1",
    "Team1Wins", "team1Wins",
  ]);
  const score2 = findNumericValue(obj, [
    "Team2Score", "team2Score", "AwayScore", "awayScore",
    "ScoreB", "score_b", "Score2", "score2",
    "Team2Wins", "team2Wins",
  ]);

  const washuScore = washuIsTeam1 ? score1 : score2;
  const opponentScore = washuIsTeam1 ? score2 : score1;

  // Try to find status
  const statusRaw = findStringValue(obj, "Status") ||
    findStringValue(obj, "status") ||
    findStringValue(obj, "MatchStatus") ||
    findStringValue(obj, "matchStatus") ||
    findStringValue(obj, "State") ||
    findStringValue(obj, "state") || "";

  let status = "upcoming";
  const sl = statusRaw.toLowerCase();
  if (sl.includes("complete") || sl.includes("finish") || sl.includes("final")) {
    status = "completed";
  } else if (sl.includes("live") || sl.includes("progress") || sl.includes("active") || sl.includes("playing")) {
    status = "live";
  }

  // Also infer status from scores
  if (status === "upcoming" && (washuScore !== null || opponentScore !== null)) {
    if (washuScore !== null && opponentScore !== null && (washuScore >= 5 || opponentScore >= 5)) {
      status = "completed";
    } else if (washuScore !== null || opponentScore !== null) {
      status = "live";
    }
  }

  // Try to find individual matches
  const individuals = extractIndividuals(obj, washuIsTeam1);

  // Try to get match time
  const time = findStringValue(obj, "Time") ||
    findStringValue(obj, "time") ||
    findStringValue(obj, "StartTime") ||
    findStringValue(obj, "startTime") ||
    findStringValue(obj, "ScheduledTime") || "";

  return {
    date,
    friendlyDate: friendlyDate(date),
    dayLabel: dayLabel(date),
    opponent: opponent || "TBD",
    washuScore,
    opponentScore,
    status,
    time,
    individuals,
  };
}

function extractIndividuals(obj, washuIsTeam1) {
  const individuals = [];

  // Look for nested arrays that might contain individual matches
  const arrayKeys = Object.keys(obj).filter((k) => Array.isArray(obj[k]));

  for (const key of arrayKeys) {
    for (const item of obj[key]) {
      if (!item || typeof item !== "object") continue;

      const ind = tryExtractIndividual(item, washuIsTeam1);
      if (ind) individuals.push(ind);
    }
  }

  // Sort by position
  individuals.sort((a, b) => (a.position || 99) - (b.position || 99));
  return individuals;
}

function tryExtractIndividual(obj, washuIsTeam1) {
  if (!obj || typeof obj !== "object") return null;

  // Try to find player names
  const player1 = findStringValue(obj, "Player1") ||
    findStringValue(obj, "player1") ||
    findStringValue(obj, "Player1Name") ||
    findStringValue(obj, "player1Name") ||
    findStringValue(obj, "HomePlayer") ||
    findStringValue(obj, "homePlayer") || "";

  const player2 = findStringValue(obj, "Player2") ||
    findStringValue(obj, "player2") ||
    findStringValue(obj, "Player2Name") ||
    findStringValue(obj, "player2Name") ||
    findStringValue(obj, "AwayPlayer") ||
    findStringValue(obj, "awayPlayer") || "";

  if (!player1 && !player2) return null;

  const washuPlayer = washuIsTeam1 ? player1 : player2;
  const oppPlayer = washuIsTeam1 ? player2 : player1;

  // Position / match number
  const position = findNumericValue(obj, [
    "Position", "position", "MatchNumber", "matchNumber",
    "Number", "number", "Pos", "pos", "Order", "order",
    "StringNumber", "stringNumber",
  ]);

  // Game scores
  const games = findStringValue(obj, "GameScores") ||
    findStringValue(obj, "gameScores") ||
    findStringValue(obj, "Scores") ||
    findStringValue(obj, "scores") ||
    findStringValue(obj, "Games") ||
    findStringValue(obj, "games") || "";

  // Match score (games won)
  const score = findStringValue(obj, "MatchScore") ||
    findStringValue(obj, "matchScore") ||
    findStringValue(obj, "Score") ||
    findStringValue(obj, "score") || "";

  // Result / winner
  let result = "upcoming";
  const winner = findStringValue(obj, "Winner") ||
    findStringValue(obj, "winner") ||
    findStringValue(obj, "Result") ||
    findStringValue(obj, "result") || "";

  const statusRaw = findStringValue(obj, "Status") ||
    findStringValue(obj, "status") ||
    findStringValue(obj, "MatchStatus") || "";

  if (winner) {
    const wLower = winner.toLowerCase();
    if (washuPlayer && wLower.includes(washuPlayer.split(" ").pop().toLowerCase())) {
      result = "win";
    } else if (oppPlayer && wLower.includes(oppPlayer.split(" ").pop().toLowerCase())) {
      result = "loss";
    } else if (wLower === "1" || wLower === "home" || wLower === "team1") {
      result = washuIsTeam1 ? "win" : "loss";
    } else if (wLower === "2" || wLower === "away" || wLower === "team2") {
      result = washuIsTeam1 ? "loss" : "win";
    }
  }

  if (result === "upcoming" && statusRaw) {
    const sLower = statusRaw.toLowerCase();
    if (sLower.includes("live") || sLower.includes("progress") || sLower.includes("playing")) {
      result = "live";
    } else if (sLower.includes("complete") || sLower.includes("finish")) {
      // Completed but couldn't determine winner - try score
      result = "completed";
    }
  }

  // Opponent school
  const oppSchool = findStringValue(obj, "Team2Name") ||
    findStringValue(obj, "team2Name") ||
    findStringValue(obj, "OpponentSchool") ||
    findStringValue(obj, "opponentSchool") || "";

  return {
    position: position || 0,
    washuPlayer: washuPlayer || "TBD",
    opponent: oppPlayer || "TBD",
    oppSchool,
    result,
    games,
    score,
  };
}

function findStringValue(obj, key) {
  if (obj[key] !== undefined && obj[key] !== null) return String(obj[key]);
  // Case-insensitive search
  const lowerKey = key.toLowerCase();
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase() === lowerKey && obj[k] !== undefined && obj[k] !== null) {
      return String(obj[k]);
    }
  }
  return null;
}

function findNumericValue(obj, keys) {
  for (const key of keys) {
    const val = obj[key];
    if (val !== undefined && val !== null && !isNaN(Number(val))) {
      return Number(val);
    }
    // Case-insensitive
    const lowerKey = key.toLowerCase();
    for (const k of Object.keys(obj)) {
      if (k.toLowerCase() === lowerKey && obj[k] !== undefined && !isNaN(Number(obj[k]))) {
        return Number(obj[k]);
      }
    }
  }
  return null;
}

// ── Build Output ────────────────────────────────────────────────────
function buildTournamentData(teamMatches) {
  // Group matches by date and assign round numbers
  const matchesByDate = {};
  for (const m of teamMatches) {
    if (!matchesByDate[m.date]) matchesByDate[m.date] = [];
    matchesByDate[m.date].push(m);
  }

  const formattedMatches = [];
  let matchId = 1;
  let roundNum = 1;

  for (const date of CONFIG.tournamentDates) {
    const dayMatches = matchesByDate[date] || [];
    for (const m of dayMatches) {
      formattedMatches.push({
        id: matchId++,
        round: `${m.dayLabel} – Round ${roundNum}`,
        date: m.friendlyDate,
        time: m.time || "TBD",
        opponent: m.opponent,
        washuScore: m.washuScore,
        opponentScore: m.opponentScore,
        status: m.status,
        individuals: m.individuals.map((ind) => ({
          position: ind.position,
          washuPlayer: ind.washuPlayer,
          opponent: ind.opponent,
          oppSchool: ind.oppSchool || m.opponent,
          result: ind.result,
          games: ind.games,
          score: ind.score,
        })),
      });
      roundNum++;
    }
  }

  // If no matches were found from API, keep placeholder matches
  if (formattedMatches.length === 0) {
    return null;
  }

  return {
    tournament: {
      name: "CSA National Collegiate Club Team Championships",
      year: 2026,
      dates: "February 13–15, 2026",
      venue: "Arlen Specter US Squash Center",
      city: "Philadelphia, PA",
      lastUpdated: new Date().toISOString(),
    },
    team: {
      name: "Washington University in St. Louis",
      shortName: "WashU",
      mascot: "Bears",
      division: "TBD",
      seed: "TBD",
    },
    featuredPlayer: CONFIG.featuredPlayer,
    teamMatches: formattedMatches,
    playerMatches: [],
  };
}

// ── File Writing ────────────────────────────────────────────────────
function writeDataFile(tournamentData) {
  const jsContent = `// ============================================
// MATCH DATA - Auto-updated from Club Locker API
// ============================================
// Last updated: ${new Date().toISOString()}

const TOURNAMENT_DATA = ${JSON.stringify(tournamentData, null, 2)};
`;

  writeFileSync(DATA_JS_PATH, jsContent, "utf-8");
  log(`Wrote ${DATA_JS_PATH}`);

  // Also write data.json for client-side dynamic refresh
  writeFileSync(DATA_JSON_PATH, JSON.stringify(tournamentData, null, 2), "utf-8");
  log(`Wrote ${DATA_JSON_PATH}`);
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  log("=== WashU Squash Score Fetcher ===");
  log(`Tournament ID: ${CONFIG.tournamentId}`);
  log(`Current time: ${new Date().toISOString()}`);

  const today = todayStr();
  log(`Today: ${today}`);

  // Determine which dates to fetch
  let datesToFetch;
  if (CONFIG.tournamentDates.includes(today)) {
    // During tournament, only fetch today (for speed)
    datesToFetch = [today];
    log("Tournament day! Fetching today's matches only.");
  } else {
    // Outside tournament days, fetch all dates
    datesToFetch = CONFIG.tournamentDates;
    log("Not a tournament day. Fetching all dates for latest results.");
  }

  let allTeamMatches = [];
  let anySuccess = false;

  for (const date of datesToFetch) {
    log(`\n--- Fetching matches for ${date} ---`);
    try {
      const data = await fetchLiveMatrix(date);
      anySuccess = true;

      if (DEBUG) {
        log("Full API response:");
        log(JSON.stringify(data, null, 2));
      } else {
        // Log a preview
        const preview = JSON.stringify(data);
        log(`Response size: ${preview.length} chars`);
        log(`Preview: ${preview.substring(0, 500)}${preview.length > 500 ? "..." : ""}`);
      }

      const matches = extractTeamMatches(data, date);
      log(`Found ${matches.length} WashU match(es) for ${date}`);
      allTeamMatches = allTeamMatches.concat(matches);
    } catch (err) {
      warn(`Failed to fetch ${date}: ${err.message}`);
    }
  }

  if (!anySuccess) {
    warn("Could not reach Club Locker API at all. Leaving data.js unchanged.");
    log("Attempting to fetch tournament info for debugging...");
    try {
      const info = await fetchTournamentInfo();
      if (info) {
        log("Found tournament info:", JSON.stringify(info, null, 2));
      } else {
        log("Tournament not found in tournament list.");
        log("The tournament ID might be different in the API vs the web URL.");
      }
    } catch (e) {
      warn("Could not fetch tournament info either:", e.message);
    }
    process.exit(1);
  }

  if (allTeamMatches.length === 0) {
    log("\nNo WashU matches found in API responses.");
    log("Possible reasons:");
    log("  1. Draws/lineups haven't been published yet");
    log("  2. Tournament ID differs between web URL and API");
    log("  3. API response format is different than expected");
    log("  4. WashU team name doesn't match our search terms");
    log("\nRun with --debug to see full API responses.");
    log("Leaving data.js unchanged.");
    process.exit(0);
  }

  log(`\n=== Found ${allTeamMatches.length} total WashU match(es) ===`);

  const tournamentData = buildTournamentData(allTeamMatches);
  if (!tournamentData) {
    log("Could not build tournament data. Leaving data.js unchanged.");
    process.exit(0);
  }

  writeDataFile(tournamentData);

  // Summary
  log("\n=== Summary ===");
  for (const m of tournamentData.teamMatches) {
    const scoreStr =
      m.status === "completed"
        ? `${m.washuScore}-${m.opponentScore}`
        : m.status === "live"
        ? `${m.washuScore || 0}-${m.opponentScore || 0} (live)`
        : "upcoming";
    log(`  ${m.round}: WashU vs ${m.opponent} - ${scoreStr}`);

    // Highlight James Sabet's match
    for (const ind of m.individuals) {
      if (isFeaturedPlayer(ind.washuPlayer)) {
        log(`    ★ ${ind.washuPlayer} (#${ind.position}): ${ind.result} ${ind.games}`);
      }
    }
  }

  log("\nDone! data.js and data.json updated.");
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
