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
  tigers:   { abbr: "DET",  prefix: "tigers",  source: "mlb",   isFootball: false, isBaseball: true  },
  giants:   { abbr: "SF",   prefix: "giants",  source: "mlb",   isFootball: false, isBaseball: true  },
  lions:    { abbr: "DET",  prefix: "lions",   source: "lions", isFootball: true,  isBaseball: false },
  michigan: { abbr: "MICH", prefix: "michigan",source: "cfb",   isFootball: true,  isBaseball: false },
  msu:      { abbr: "MSU",  prefix: "msu",     source: "cfb",   isFootball: true,  isBaseball: false }
};

//////////////////////////////
//  DOM Helpers             //
//////////////////////////////

function showCard(prefix) {
  const card = document.getElementById(`${prefix}-card`);
  if (card) card.style.display = "flex";
}

function hideCard(prefix) {
  const card = document.getElementById(`${prefix}-card`);
  if (card) card.style.display = "none";
}

function setCardLoading(prefix) {
  const gameEl = document.getElementById(`${prefix}-game`);
  const pillEl = document.getElementById(`${prefix}-status-pill`);
  const textEl = document.getElementById(`${prefix}-status-text`);

  if (!gameEl || !pillEl || !textEl) return;

  showCard(prefix);

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

  showCard(prefix);

  gameEl.textContent = "Error loading scores";
  gameEl.classList.add("error-text");
  pillEl.textContent = "Error";
  pillEl.className = "status-pill";
  textEl.textContent = "";
}

function setCardNoGame(prefix) {
  // Instead of showing "No game today", just hide the card
  hideCard(prefix);
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

// Build inning / count / bases string for baseball
function buildBaseballSituation(competition, event) {
  const situation = competition.situation;
  if (!situation) return "";

  const status = event.status || {};
  const type   = status.type || {};
  if (type.state !== "in") return "";

  const inning = situation.inning;
  let halfLabel = situation.inningHalf || "";
  if (!halfLabel && typeof situation.isTopInning === "boolean") {
    halfLabel = situation.isTopInning ? "Top" : "Bot";
  }

  const balls   = situation.balls;
  const strikes = situation.strikes;
  const outs    = situation.outs;

  const onFirst  = situation.onFirst;
  const onSecond = situation.onSecond;
  const onThird  = situation.onThird;

  const pieces = [];

  if (inning != null) {
    const half = halfLabel || "";
    pieces.push(`${half} ${inning}`.trim());
  }

  if (balls != null && strikes != null) {
    pieces.push(`B:${balls} S:${strikes}`);
  }

  if (outs != null) {
    pieces.push(`O:${outs}`);
  }

  // Bases: 1--, -2-, --3, 123, etc.
  const basesArr = [
    onFirst  ? "1" : "-",
    onSecond ? "2" : "-",
    onThird  ? "3" : "-"
  ];
  const basesStr = basesArr.join("");
  pieces.push(`Bases:${basesStr}`);

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

function updateTeamCard(prefix, abbr, scoreboardData, isFootball, isBaseball) {
  try {
    const events = (scoreboardData && scoreboardData.events) || [];
    const hit = findTeamGame(events, abbr);

    if (!hit) {
      // No event for this team on today's scoreboard → hide
      setCardNoGame(prefix);
      return;
    }

    // We have a game → ensure card is visible
    showCard(prefix);

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

    // Football: down/distance/possession when live
    if (isFootball && st.state === "in") {
      const situText = buildSituation(hit.competition, hit.event);
      textEl.textContent = situText || st.text;

    // Baseball: inning / count / bases when live
    } else if (isBaseball && st.state === "in") {
      const bSitu = buildBaseballSituation(hit.competition, hit.event);
      textEl.textContent = bSitu || st.text;

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

    updateTeamCard("tigers",   "DET",  mlbData, false, true);
    updateTeamCard("giants",   "SF",   mlbData, false, true);
    updateTeamCard("lions",    "DET",  nflData, true,  false);
    updateTeamCard("michigan", "MICH", cfbData, true,  false);
    updateTeamCard("msu",      "MSU",  cfbData, true,  false);

  } catch (err) {
    console.error("Error refreshing scores:", err);
    Object.values(TEAM_CONFIG).forEach(team => setCardError(team.prefix));
  }
}

// Initial load
refreshScores();

// Refresh every 60 seconds
setInterval(refreshScores, 60 * 1000);
