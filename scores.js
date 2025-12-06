//////////////////////////////
//  ESPN Scoreboard URLs   //
//////////////////////////////

const ENDPOINTS = {
  tigers: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
  lions: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  msu: "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard"
};

//////////////////////////////
//  DOM Helper Functions    //
//////////////////////////////

function setCardLoading(teamPrefix) {
  document.getElementById(`${teamPrefix}-game`).textContent = "Loading...";
  document.getElementById(`${teamPrefix}-status-pill`).textContent = "...";
  document.getElementById(`${teamPrefix}-status-pill`).className = "status-pill";
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
 * Find the first event in the ESPN scoreboard that matches the given team abbrev.
 * (e.g. "DET", "MSU")
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
 * Build a simple line like "DET 4 @ CHC 2" from an event.
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
 * Decide pill text + status text + class based on ESPN "status".
 */
function buildStatus(event) {
  const status = event.status || {};
  const type = status.type || {};
  const state = type.state || "pre"; // "pre", "in", "post"
  const shortDetail = type.shortDetail || type.detail || type.description || "";
  const clock = status.displayClock || "";
  const period = status.period;

  let pill = "";
  let pillClass = "status-pill";
  let text = "";

  if (state === "in") {
    pill = "Live";
    pillClass += " live";
    // example: "Final/OT", "3rd 10:21", or we just display shortDetail
    text = shortDetail || (clock ? `${clock}` : "In progress");
  } else if (state === "post") {
    pill = "Final";
    pillClass += " final";
    text = shortDetail || "Game finished";
  } else {
    // "pre" or anything else
    pill = "Scheduled";
    pillClass += " scheduled";
    text = shortDetail || "Upcoming";
  }

  return { pill, pillClass, text };
}

/**
 * Update a given team card with data for a scoreboard + team abbreviation.
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

    const gameLine = buildGameLine(competition);
    const statusInfo = buildStatus(event);

    const gameEl = document.getElementById(`${teamPrefix}-game`);
    const pillEl = document.getElementById(`${teamPrefix}-status-pill`);
    const textEl = document.getElementById(`${teamPrefix}-status-text`);

    gameEl.textContent = gameLine;
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
  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function refreshScores() {
  // set loading text
  setCardLoading("tigers");
  setCardLoading("lions");
  setCardLoading("msu");

  try {
    const [mlbData, nflData, cfbData] = await Promise.all([
      fetchScoreboard(ENDPOINTS.tigers),
      fetchScoreboard(ENDPOINTS.lions),
      fetchScoreboard(ENDPOINTS.msu)
    ]);

    // Tigers = DET in MLB
    updateTeamCard("tigers", "DET", mlbData);

    // Lions = DET in NFL
    updateTeamCard("lions", "DET", nflData);

    // Michigan State = MSU in college football
    updateTeamCard("msu", "MSU", cfbData);

    const updatedEl = document.getElementById("updated-time");
    const now = new Date();
    updatedEl.textContent = `Last updated: ${now.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    })}`;
  } catch (err) {
    console.error("Error refreshing scores:", err);
    setCardError("tigers");
    setCardError("lions");
    setCardError("msu");
    const updatedEl = document.getElementById("updated-time");
    updatedEl.textContent = "Last updated: error contacting ESPN";
  }
}

// Initial load
refreshScores();

// Optional: auto-refresh every 60 seconds
setInterval(refreshScores, 60 * 1000);
