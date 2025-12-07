//////////////////////////////
// ESPN Scoreboard Endpoints
//////////////////////////////

const ENDPOINTS = {
  mlb:   "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
  nfl:   "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  cfb:   "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80"
};

//////////////////////////////
// Team Definitions
//////////////////////////////

const TEAM_CONFIG = {
  tigers:   { abbr: "DET",  prefix: "tigers",  source: "mlb", isFootball: false, isBaseball: true },
  giants:   { abbr: "SF",   prefix: "giants",  source: "mlb", isFootball: false, isBaseball: true },
  lions:    { abbr: "DET",  prefix: "lions",   source: "nfl", isFootball: true,  isBaseball: false },
  commanders: { abbr: "WSH", prefix: "commanders", source: "nfl", isFootball: true, isBaseball: false },
  michigan: { abbr: "MICH", prefix: "michigan",source: "cfb", isFootball: true,  isBaseball: false },
  msu:      { abbr: "MSU",  prefix: "msu",     source: "cfb", isFootball: true,  isBaseball: false }
};

//////////////////////////////
// Sticky-note Tilt Logic
//////////////////////////////

const TILT_OPTIONS = [-4, -3, -2, -1, 1, 2, 3, 4];
const CARD_TILTS = {};

function getTilt(prefix) {
  if (!CARD_TILTS[prefix]) {
    CARD_TILTS[prefix] = TILT_OPTIONS[Math.floor(Math.random() * TILT_OPTIONS.length)];
  }
  return CARD_TILTS[prefix];
}

function applyTilt(prefix) {
  const card = document.getElementById(`${prefix}-card`);
  if (card) {
    card.style.transform = `rotate(${getTilt(prefix)}deg)`;
  }
}

//////////////////////////////
// Card Visibility Helpers
//////////////////////////////

function showCard(prefix) {
  const card = document.getElementById(`${prefix}-card`);
  if (card) {
    card.style.display = "flex";
    applyTilt(prefix);
  }
}

function hideCard(prefix) {
  const card = document.getElementById(`${prefix}-card`);
  if (card) {
    card.style.display = "none";
  }
}

// Keep this around if you ever want to re-enable a loading state,
// but it is NOT used anywhere now (no visual changes on refresh).
function setCardLoading(prefix) {
  const gameEl = document.getElementById(`${prefix}-game`);
  const pillEl = document.getElementById(`${prefix}-status-pill`);
  const textEl = document.getElementById(`${prefix}-status-text`);

  if (!gameEl || !pillEl || !textEl) return;

  gameEl.classList.remove("error-text");
  // No text changes, no pill changes → zero visual flash
}

function setCardError(prefix) {
  showCard(prefix);
  const game = document.getElementById(`${prefix}-game`);
  const pill = document.getElementById(`${prefix}-status-pill`);
  const text = document.getElementById(`${prefix}-status-text`);

  if (!game || !pill || !text) return;

  game.textContent = "Error loading";
  game.classList.add("error-text");
  pill.textContent = "Error";
  pill.className = "status-pill";
  text.textContent = "";
}

//////////////////////////////
// ESPN Data Parsing
//////////////////////////////

function findTeamGame(events, abbr) {
  if (!events) return null;
  for (const e of events) {
    const comp = e.competitions?.[0];
    if (!comp || !comp.competitors) continue;
    if (comp.competitors.some(t => t.team?.abbreviation === abbr)) {
      return { event: e, competition: comp };
    }
  }
  return null;
}

function buildGameLine(comp) {
  const home = comp.competitors.find(c => c.homeAway === "home") || comp.competitors[0];
  const away = comp.competitors.find(c => c.homeAway === "away") || comp.competitors[1];

  const homeAbbr = home?.team?.abbreviation || "HOME";
  const awayAbbr = away?.team?.abbreviation || "AWAY";

  const homeScore = home?.score ?? "-";
  const awayScore = away?.score ?? "-";

  return `${awayAbbr} ${awayScore} @ ${homeAbbr} ${homeScore}`;
}

function buildBaseballSituation(comp, event) {
  const sit = comp.situation;
  if (!sit) return "";

  const inning = sit.inning;
  const half = sit.isTopInning ? "Top" : "Bot";

  const bases = [
    sit.onFirst ? "1" : "-",
    sit.onSecond ? "2" : "-",
    sit.onThird ? "3" : "-"
  ].join("");

  const balls   = sit.balls;
  const strikes = sit.strikes;
  const outs    = sit.outs;

  const pieces = [];
  if (inning != null) pieces.push(`${half} ${inning}`);
  if (balls != null && strikes != null) pieces.push(`B:${balls} S:${strikes}`);
  if (outs != null) pieces.push(`O:${outs}`);
  pieces.push(bases);

  return pieces.join(" • ");
}

function buildFootballSituation(comp, event) {
  const sit = comp.situation;
  if (!sit) return "";

  const downIndex = sit.down;
  const dist = sit.distance;
  const possText = sit.possessionText || "";

  const downMap = ["", "1st", "2nd", "3rd", "4th"];
  const downStr = downMap[downIndex] || "";

  const pieces = [];
  if (downStr && dist != null) pieces.push(`${downStr} & ${dist}`);
  if (possText) pieces.push(possText);

  return pieces.join(" • ");
}

function buildStatus(event) {
  const type = event.status?.type || {};
  const state = type.state || "pre"; // "pre", "in", "post"

  if (state === "in") {
    return { pill: "Live", pillClass: "status-pill live", state: "in" };
  }
  if (state === "post") {
    return { pill: "Final", pillClass: "status-pill final", state: "post" };
  }
  return { pill: "Scheduled", pillClass: "status-pill scheduled", state: "pre" };
}

//////////////////////////////
// Updating Cards
//////////////////////////////

function updateTeamCard(prefix, abbr, data, isFootball, isBaseball) {
  const events = data?.events;
  const found = findTeamGame(events, abbr);

  if (!found) {
    hideCard(prefix);
    return;
  }

  showCard(prefix);

  const gameEl = document.getElementById(`${prefix}-game`);
  const pillEl = document.getElementById(`${prefix}-status-pill`);
  const textEl = document.getElementById(`${prefix}-status-text`);

  if (!gameEl || !pillEl || !textEl) return;

  const line = buildGameLine(found.competition);
  const status = buildStatus(found.event);

  gameEl.textContent = line;
  gameEl.classList.remove("error-text");

  pillEl.textContent = status.pill;
  pillEl.className = status.pillClass;

  if (status.state === "in") {
    if (isBaseball) {
      textEl.textContent = buildBaseballSituation(found.competition, found.event);
    } else if (isFootball) {
      textEl.textContent = buildFootballSituation(found.competition, found.event);
    } else {
      textEl.textContent = "";
    }
  } else {
    textEl.textContent = ""; // pre / post: no extra situation text
  }
}

//////////////////////////////
// Fetching Data
//////////////////////////////

async function fetchScores(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function refreshScores() {
  try {
    const [mlb, nfl, cfb] = await Promise.all([
      fetchScores(ENDPOINTS.mlb),
      fetchScores(ENDPOINTS.nfl),
      fetchScores(ENDPOINTS.cfb)
    ]);

    updateTeamCard("tigers",   "DET",  mlb, false, true);
    updateTeamCard("giants",   "SF",   mlb, false, true);
    updateTeamCard("lions",    "DET",  nfl, true,  false);
    updateTeamCard("commanders", "WSH", nfl, true, false);
    updateTeamCard("michigan", "MICH", cfb, true,  false);
    updateTeamCard("msu",      "MSU",  cfb, true,  false);

  } catch (err) {
    console.error("Error refreshing scores:", err);
    Object.values(TEAM_CONFIG).forEach(t => setCardError(t.prefix));
  }
}

refreshScores();
setInterval(refreshScores, 60000);
