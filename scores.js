//////////////////////////////
//  ESPN Scoreboard URLs   //
//////////////////////////////
//
// These are league-wide scoreboards; we ONLY pull out your 3 teams.
//
const ENDPOINTS = {
  // Detroit Tigers (MLB)
  tigers: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",

  // Detroit Lions (NFL)
  lions: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",

  // Michigan State Spartans (NCAAF, FBS)
  // groups=80 = FBS; safe to omit if you want the default full board.
  msu: "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80"
};

//////////////////////////////
//  Team Config (ONLY these)//
//////////////////////////////

const TEAM_CONFIG = {
  tigers: {
    abbr: "DET",          // Detroit Tigers on MLB board
    prefix: "tigers"
  },
  lions: {
    abbr: "DET",          // Detroit Lions on NFL board
    prefix: "lions"
  },
  msu: {
    abbr: "MSU",          // Michigan State Spartans on CFB board
    prefix: "msu"
  }
};

//////////////////////////////
//  DOM Helpers             //
//////////////////////////////

function setCardLoading(teamPrefix) {
  document.getElementById(`${teamPrefix}-game`).textContent = "Loading...";
  const pill = document.getElementById(`${teamPrefix}-status-pill`);
  pill.textContent = "...";
  pill.className = "status-pill";
  document.getElementById(`${teamPrefix}-status-text`).textContent = "";
}

function setCardError(teamPrefix) {
  const gameEl = document.getElementById(`${teamPrefix}-game`);
  const pillEl = document.getElementById(`${teamPrefix}-status-pill`);
  const textEl = document.getElementById(`${teamPrefix}-status-text`);

  gameEl.textContent = "Error loading scores";
  gameEl.classList.add("error-text");
  pillEl.textContent = "Error";
  pillEl.className = "status-pill";
  textEl.textContent = "";
}

function setCardNoGame(teamPrefix) {
  const gameEl = document.getElementById(`${teamPrefix}-game`);
  const pillEl = document.getElementById(`${teamPrefix}-status-pill`);
  const textEl = document.getElementById(`${teamPrefix}-status-text`);

  gameEl.textContent = "No game today";
  gameEl.classList.remove("error-text");
  pillEl.textContent = "Idle";
  pillEl.className = "status-pill";
  textEl.textContent = "";
}

//////////////////////////////
//  Data Parsing Helpers    //
//////////////////////////////

/**
 * Find the first event where ANY competitor has the given team abbreviation.
 * We only call this with the 3 team abbrs you care about.
 */
function findTeamGame(events, teamAbbr) {
  if (!Array.isArray(events)) return null;

  for (const event of events) {
    const comp = event.competitions && event.competitions[0];
    if (!comp || !Array.isArray(comp.competitors)) continue;

    const competitors = comp.competitors;
    const match = competitors.find(
      (c) => c.team && c.team.abbreviation === teamAbbr
    );
    if (match) {
      return { event, competition: comp };
    }
  }

  return null;
}

/**
 * Build "AWAY 3 @ HOME 2" from competition object.
 */
function buildGameLine(competition) {
  const competitors = competition.competitors || [];

  const home = competitors.find((c) => c.homeAway === "home") || competitors[0];
  const away = competitors.find((c) => c.homeAway === "away") || competitors[1];

  const homeAbbr = home?.team?.abbreviation || "HOME";
  const awayAbbr = away?.team?.abbreviation || "AWAY";

  const homeScore = home?.score ?? (home?.score === "0" ? "0" : "-");
  const awayScore = away?.score ?? (away?.score === "0" ? "0" : "-");

  return `${awayAbbr} ${awayScore} @ ${homeAbbr} ${homeScore}`;
}

/**
 * Decide pill text + status text + class from ESPN status.
 */
function buildStatus(event) {
  const status = event.status || {};
  const type = status.type || {};
  const state = type.state || "pre"; // "pre", "in", "post"
  const shortDetail = type.shortDetail || type.detail || type.description || "";
  const clock = status.displayClock || "";

  let pill = "";
  let pillClass = "status-pill";
  let text = "";

  if (state === "in") {
    pill = "Live";
    pillClass += " live";
    text = shortDetail || (clock ? clock : "In progress");
  } else if (state === "post") {
    pill = "Final";
    pillClass += " final";
    text = shortDetail || "Game finished";
  } else {
    pill = "Scheduled";
    pillClass += " scheduled";
    text = shortDetail || "Upcoming";
  }

  return { pill, pillClass, text };
}

/**
 * Update a card for one of your teams only.
 */
function updateTeamCard(teamPrefix, teamAbbr, scoreboardData) {
  try {
    const events = scoreboardData.events || [];
    const match = findTeamGame(events, teamAbbr);

    if (!match) {
      setCardNoGame(teamPrefix);
      return;
    }

    const { event, competition } = match;

    const line = buildGameLine(competition);
    const statusInfo = buildStatus(event);

    const gameEl = document.getElementById(`${teamPrefix}-game`);
    const pillEl = document.getElementById(`${teamPrefix}-status-pill`);
    const textEl = document.getElementById(`${teamPrefix}-status-text`);

    gameEl.textContent = line;
    gameEl.classList.remove("error-text");
    pillEl.textContent = statusInfo.pill;
    pillEl.className = statusInfo.pillClass;
    textEl.textContent = statusInfo.text;
  } catch (err) {
    console.error(`Error updating card for ${teamPrefix}:`, err);
    setCardError(teamPrefix);
  }
}

//////////////////////////////
//  Fetch + Refresh Logic   //
//////////////////////////////

async function fetchScoreboard(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function refreshScores() {
  // Show loading for just your three cards
  Object.values(TEAM_CONFIG).forEach(cfg => setCardLoading(cfg.prefix));

  try {
    const [mlbData, nflData, cfbData] = await Promise.all([
      fetchScoreboard(ENDPOINTS.tigers),
      fetchScoreboard(ENDPOINTS.lions),
      fetchScoreboard(ENDPOINTS.msu)
    ]);

    updateTeamCard(TEAM_CONFIG.tigers.prefix, TEAM_CONFIG.tigers.abbr, mlbData);
    updateTeamCard(TEAM_CONFIG.lions.prefix,  TEAM_CONFIG.lions.abbr,  nflData);
    updateTeamCard(TEAM_CONFIG.msu.prefix,    TEAM_CONFIG.msu.abbr,    cfbData);

    const updatedEl = document.getElementById("updated-time");
    const now = new Date();
    updatedEl.textContent = `Last updated: ${now.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    })}`;
  } catch (err) {
    console.error("Error refreshing scores:", err);

    Object.values(TEAM_CONFIG).forEach(cfg => setCardError(cfg.prefix));

    const updatedEl = document.getElementById("updated-time");
    updatedEl.textContent = "Last updated: error contacting ESPN";
  }
}

// Initial load
refreshScores();

// Auto-refresh every 60 seconds
setInterval(refreshScores, 60 * 1000);
