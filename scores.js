//////////////////////////////
//  ESPN Scoreboard URLs   //
//////////////////////////////

const ENDPOINTS = {
  tigers:  "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
  lions:   "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  cfb:     "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80"
};

//////////////////////////////
//  Team Configuration      //
//////////////////////////////

const TEAM_CONFIG = {
  tigers:   { abbr: "DET",  prefix: "tigers",   source: "tigers" },
  lions:    { abbr: "DET",  prefix: "lions",    source: "lions"  },
  michigan: { abbr: "MICH", prefix: "michigan", source: "cfb"    },
  msu:      { abbr: "MSU",  prefix: "msu",      source: "cfb"    }
};

//////////////////////////////
//  DOM Helper Functions    //
//////////////////////////////

function setCardLoading(prefix) {
  const gameEl  = document.getElementById(`${prefix}-game`);
  const pillEl  = document.getElementById(`${prefix}-status-pill`);
  const textEl  = document.getElementById(`${prefix}-status-text`);

  if (!gameEl || !pillEl || !textEl) return;

  gameEl.textContent = "Loading...";
  gameEl.classList.remove("error-text");
  pillEl.textContent = "...";
  pillEl.className   = "status-pill";
  textEl.textContent = "";
}

function setCardError(prefix) {
  const gameEl  = document.getElementById(`${prefix}-game`);
  const pillEl  = document.getElementById(`${prefix}-status-pill`);
  const textEl  = document.getElementById(`${prefix}-status-text`);

  if (!gameEl || !pillEl || !textEl) return;

  gameEl.textContent = "Error loading scores";
  gameEl.classList.add("error-text");
  pillEl.textContent = "Error";
  pillEl.className   = "status-pill";
  textEl.textContent = "";
}

function setCardNoGame(prefix) {
  const gameEl  = document.getElementById(`${prefix}-game`);
  const pillEl  = document.getElementById(`${prefix}-status-pill`);
  const textEl  = document.getElementById(`${prefix}-status-text`);

  if (!gameEl || !pillEl || !textEl) return;

  gameEl.textContent = "No game today";
  gameEl.classList.remove("error-text");
  pillEl.textContent = "Idle";
  pillEl.className   = "status-pill";
  textEl.textContent = "";
}

//////////////////////////////
//  ESPN Parsing Helpers    //
//////////////////////////////

// Find first event where any competitor has the given abbreviation
function findTeamGame(events, abbr) {
  if (!Array.isArray(events)) return null;

  for (const event of events) {
    const comp = event.competitions && event.competitions[0];
    if (!comp || !Array.isArray(comp.competitors)) continue;

    const competitors = comp.competitors;
    const hit = competitors.find(c => c.team && c.team.abbreviation === abbr);
    if (hit) return { event, competition: comp };
  }

  return null;
}

// Build "AWAY 3 @ HOME 2"
function buildGameLine(competition) {
  const competitors = competition.competitors || [];

  const home = competitors.find(c => c.homeAway === "home") || competitors[0];
  const away = competitors.find(c => c.homeAway === "away") || competitors[1];

  const homeAbbr = home?.team?.abbreviation || "HOME";
  const awayAbbr = away?.team?.abbreviation || "AWAY";

  const homeScore = (home && home.score != null) ? home.score : "-";
  const awayScore = (away && away.score != null) ? away.score : "-";

  return `${awayAbbr} ${awayScore} @ ${homeAbbr} ${homeScore}`;
}

// Build pill text + class + detail from ESPN status
function buildStatus(event) {
  const status = event.status || {};
  const type   = status.type || {};
  const state  = type.state || "pre";   // "pre" | "in" | "post"

  let pill      = "Scheduled";
  let pillClass = "status-pill scheduled";
  let text      = type.shortDetail || type.detail || type.description || "";

  if (state === "in") {
    pill      = "Live";
    pillClass = "status-pill live";
  } else if (state === "post") {
    pill      = "Final";
    pillClass = "status-pill final";
  }

  return { pill, pillClass, text };
}

// Update a single team card from a scoreboard dataset
function updateTeamCard(prefix, abbr, scoreboardData) {
  try {
    const events = scoreboardData && scoreboardData.events ? scoreboardData.events : [];
    const hit = findTeamGame(events, abbr);

    if (!hit) {
      setCardNoGame(prefix);
      return;
    }

    const gameLine  = buildGameLine(hit.competition);
    const statusInf = buildStatus(hit.event);

    const gameEl = document.getElementById(`${prefix}-game`);
    const pillEl = document.getElementById(`${prefix}-status-pill`);
    const textEl = document.getElementById(`${prefix}-status-text`);

    if (!gameEl || !pillEl || !textEl) return;

    gameEl.textContent = gameLine;
    gameEl.classList.remove("error-text");
    pillEl.textContent = statusInf.pill;
    pillEl.className   = statusInf.pillClass;
    textEl.textContent = statusInf.text;

  } catch (err) {
    console.error(`Error updating card for ${prefix}:`, err);
    setCardError(prefix);
  }
}

//////////////////////////////
//  Fetch + Refresh Logic   //
//////////////////////////////

async function fetchScoreboard(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function refreshScores() {
  // Set all cards to loading state
  Object.values(TEAM_CONFIG).forEach(team => setCardLoading(team.prefix));

  try {
    const [mlbData, nflData, cfbData] = await Promise.all([
      fetchScoreboard(ENDPOINTS.tigers),
      fetchScoreboard(ENDPOINTS.lions),
      fetchScoreboard(ENDPOINTS.cfb)
    ]);

    // Tigers & Lions
    updateTeamCard("tigers",   "DET",  mlbData);
    updateTeamCard("lions",    "DET",  nflData);

    // Michigan & MSU (same CFB scoreboard)
    updateTeamCard("michigan", "MICH", cfbData);
    updateTeamCard("msu",      "MSU",  cfbData);

    const updatedEl = document.getElementById("updated-time");
    if (updatedEl) {
      const now = new Date();
      updatedEl.textContent = "Last updated: " +
        now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }

  } catch (err) {
    console.error("Error refreshing scores:", err);
    Object.values(TEAM_CONFIG).forEach(team => setCardError(team.prefix));

    const updatedEl = document.getElementById("updated-time");
    if (updatedEl) {
      updatedEl.textContent = "Last updated: error contacting ESPN";
    }
  }
}

// Initial load
refreshScores();

// Refresh every 60 seconds
setInterval(refreshScores, 60 * 1000);
