//////////////////////////////
//  ESPN Scoreboard URLs   //
//////////////////////////////

const ENDPOINTS = {
  mlb:   "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
  lions: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  cfb:   "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80"
};

//////////////////////////////
//  Team Configuration      //
//////////////////////////////

const TEAM_CONFIG = {
  tigers:   { abbr: "DET", prefix: "tigers",  source: "mlb",   isFootball: false },
  giants:   { abbr: "SF",  prefix: "giants",  source: "mlb",   isFootball: false },
  lions:    { abbr: "DET", prefix: "lions",   source: "lions", isFootball: true  },
  michigan: { abbr: "MICH",prefix: "michigan",source: "cfb",   isFootball: true  },
  msu:      { abbr: "MSU", prefix: "msu",     source: "cfb",   isFootball: true  }
};

//////////////////////////////
//  DOM Helpers             //
//////////////////////////////

function setCardLoading(prefix) {
  const gameEl = document.getElementById(`${prefix}-game`);
  const pillEl = document.getElementById(`${prefix}-status-pill`);
  const textEl = document.getElementById(`${prefix}-status-text`);

  if (!gameEl || !pillEl || !textEl) return;

  gameEl.textContent = "Loading...";
  gameEl.classList.remove("error-text");
  pillEl.textContent = "...";
  pillEl.className = "status-pill";
  textEl.textContent = "";
}

function setCardError(prefix) {
  const gameEl = document.getElementById(`${prefix}-game`);
  const pillEl = document.getElementById(`${prefix}-status-pill`);
  const textEl = document.getElementById(`${prefix}-status-text`);

  if (!gameEl || !pillEl || !textEl) return;

  gameEl.textContent = "Error loading scores";
  gameEl.classList.add("error-text");
  pillEl.textContent = "Error";
  pillEl.className = "status-pill";
  textEl.textContent = "";
}

function setCardNoGame(prefix) {
  const gameEl = document.getElementById(`${prefix}-game`);
  const pillEl = document.getElementById(`${prefix}-status-pill`);
  const textEl = document.getElementById(`${prefix}-status-text`);

  if (!gameEl || !pillEl || !textEl) return;

  gameEl.textContent = "No game today";
  gameEl.classList.remove("error-text");
  pillEl.textContent = "Idle";
  pillEl.className = "status-pill";
  textEl.textContent = "";
}

//////////////////////////////
//  ESPN Parsing Helpers    //
//////////////////////////////

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

// Build down/distance/possession string for football
function buildSituation(competition, event) {
  const situation = competition.situation;
  if (!situation) return "";

  const status = event.status || {};
  const period = status.period;
  const clock  = status.displayClock || "";

  const down   = situation.down;
  const dist   = situation.distance;
  const yardLn = situation.yardLine;
  const terr   = situation.yardLineTerritory; // e.g. "DET"

  // Figure out possession team abbreviation
  let possAbbr = "";
  if (situation.possession) {
    const comps = competition.competitors || [];
    const possTeam = comps.find(
      c =>
        String(c.id) === String(situation.possession) ||
        String(c.team?.id) === String(situation.possession)
    );
    possAbbr = possTeam?.team?.abbreviation || "";
  }

  // Down & distance
  let downDist = "";
  if (down && dist != null) {
    const ordMap = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th" };
    const ord = ordMap[down] || `${down}th`;
    downDist = `${ord} & ${dist}`;
  }

  // Field position
  let fieldPos = "";
  if (yardLn != null && terr) {
    fieldPos = `${terr} ${yardLn}`;
  }

  const pieces = [];

  if (period) pieces.push(`Q${period}`);
  if (clock)  pieces.push(clock);
  if (downDist) pieces.push(downDist);
  if (possAbbr) pieces.push(`${possAbbr} ball`);
  if (fieldPos) pieces.push(`@ ${fieldPos}`);

  return pieces.join(" • ");
}

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

  return { pill, pillClass, text, state };
}

function updateTeamCard(prefix, abbr, scoreboardData, isFootball) {
  try {
    const events = (scoreboardData && scoreboardData.events) || [];
    const hit = findTeamGame(events, abbr);

    if (!hit) {
      setCardNoGame(prefix);
      return;
    }

    const line = buildGameLine(hit.competition);
    const st   = buildStatus(hit.event);

    const gameEl = document.getElementById(`${prefix}-game`);
    const pillEl = document.getElementById(`${prefix}-status-pill`);
    const textEl = document.getElementById(`${prefix}-status-text`);

    if (!gameEl || !pillEl || !textEl) return;

    gameEl.textContent = line;
    gameEl.classList.remove("error-text");
    pillEl.textContent = st.pill;
    pillEl.className   = st.pillClass;

    // For football, when live, try to show down/distance/possession
    if (isFootball && st.state === "in") {
      const situText = buildSituation(hit.competition, hit.event);
      textEl.textContent = situText || st.text;
    } else {
      textEl.textContent = st.text;
    }

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
  Object.values(TEAM_CONFIG).forEach(team => setCardLoading(team.prefix));

  try {
    const [mlbData, nflData, cfbData] = await Promise.all([
      fetchScoreboard(ENDPOINTS.mlb),
      fetchScoreboard(ENDPOINTS.lions),
      fetchScoreboard(ENDPOINTS.cfb)
    ]);

    updateTeamCard("tigers",   "DET",  mlbData, false);
    updateTeamCard("giants",   "SF",   mlbData, false);
    updateTeamCard("lions",    "DET",  nflData, true);
    updateTeamCard("michigan", "MICH", cfbData, true);
    updateTeamCard("msu",      "MSU",  cfbData, true);

  } catch (err) {
    console.error("Error refreshing scores:", err);
    Object.values(TEAM_CONFIG).forEach(team => setCardError(team.prefix));
  }
}

// Initial load
refreshScores();

// Refresh every 60 seconds
setInterval(refreshScores, 60 * 1000);
