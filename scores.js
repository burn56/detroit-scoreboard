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
  tigers:   { abbr: "DET",  prefix: "tigers",   source: "mlb",   isFootball: false, isBaseball: true  },
  giants:   { abbr: "SF",   prefix: "giants",   source: "mlb",   isFootball: false, isBaseball: true  },
  lions:    { abbr: "DET",  prefix: "lions",    source: "lions", isFootball: true,  isBaseball: false },
  michigan: { abbr: "MICH", prefix: "michigan", source: "cfb",   isFootball: true,  isBaseball: false },
  msu:      { abbr: "MSU",  prefix: "msu",      source: "cfb",   isFootball: true,  isBaseball: false }
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

    const hit = comp.competitors.find(
      c => c.team && c.team.abbreviation === abbr
    );
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

  const homeScore = home && home.score != null ? home.score : "-";
  const awayScore = away && away.score != null ? away.score : "-";

  return `${awayAbbr} ${awayScore} @ ${homeAbbr} ${homeScore}`;
}

// Football: down/distance/possession
function buildFootballSituation(competition, event) {
  const situation = competition.situation;
  if (!situation) return "";

  const status = event.status || {};
  const period = status.period;
  const clock  = status.displayClock || "";

  const down   = situation.down;
  const dist   = situation.distance;
  const yardLn = situation.yardLine;
  const terr   = situation.yardLineTerritory;

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

  let downDist = "";
  if (down && dist != null) {
    const ordMap = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th" };
    const ord = ordMap[down] || `${down}th`;
    downDist = `${ord} & ${dist}`;
  }

  let fieldPos = "";
  if (yardLn != null && terr) {
    fieldPos = `${terr} ${yardLn}`;
  }

  const pieces = [];
  if (period)   pieces.push(`Q${period}`);
  if (clock)    pieces.push(clock);
  if (downDist) pieces.push(downDist);
  if (possAbbr) pieces.push(`${possAbbr} ball`);
  if (fieldPos) pieces.push(`@ ${fieldPos}`);

  return pieces.join(" • ");
}

// Baseball: inning / count / bases
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

  const basesArr = [
    onFirst  ? "1" : "-",
    onSecond ? "2" : "-",
    onThird  ? "3" : "-"
  ];
  pieces.push(`Bases:${basesArr.join("")}`);

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
    const events = Array.isArray(scoreboardData?.events)
      ? scoreboardData.events
      : [];

    if (events.length === 0) {
      setCardNoGame(prefix);
      return;
    }

    const hit = findTeamGame(events, abbr);

    if (!hit) {
      setCardNoGame(prefix);
      return;
    }

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

    if (isFootball && st.state === "in") {
      const situText = buildFootballSituation(hit.competition, hit.event);
      textEl.textContent = situText || st.text;
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
//  Championship Game Logic //
//////////////////////////////

function findWorldSeriesGame(events) {
  if (!Array.isArray(events)) return null;
  const keyword = "world series";
  const lower = keyword.toLowerCase();

  const ev = events.find(e => {
    const name      = (e.name || "").toLowerCase();
    const shortName = (e.shortName || "").toLowerCase();
    return name.includes(lower) || shortName.includes(lower);
  });
  if (!ev) return null;

  const comp = ev.competitions && ev.competitions[0];
  if (!comp) return null;

  return { event: ev, competition: comp, type: "mlb" };
}

function findSuperBowlGame(events) {
  if (!Array.isArray(events)) return null;
  const keyword = "super bowl";
  const lower = keyword.toLowerCase();

  const ev = events.find(e => {
    const name      = (e.name || "").toLowerCase();
    const shortName = (e.shortName || "").toLowerCase();
    return name.includes(lower) || shortName.includes(lower);
  });
  if (!ev) return null;

  const comp = ev.competitions && ev.competitions[0];
  if (!comp) return null;

  return { event: ev, competition: comp, type: "nfl" };
}

function updateChampionshipCard(mlbData, nflData) {
  const champCardPrefix = "champ";

  const mlbEvents = Array.isArray(mlbData?.events) ? mlbData.events : [];
  const nflEvents = Array.isArray(nflData?.events) ? nflData.events : [];

  // Priority: Super Bowl > World Series
  let champ = findSuperBowlGame(nflEvents);
  if (!champ) champ = findWorldSeriesGame(mlbEvents);

  if (!champ) {
    hideCard(champCardPrefix);
    return;
  }

  showCard(champCardPrefix);

  const leagueEl = document.getElementById("champ-league");
  const nameEl   = document.getElementById("champ-name");
  const gameEl   = document.getElementById("champ-game");
  const pillEl   = document.getElementById("champ-status-pill");
  const textEl   = document.getElementById("champ-status-text");
  const logoImg  = document.querySelector("#champ-card .team-logo img");

  if (!leagueEl || !nameEl || !gameEl || !pillEl || !textEl || !logoImg) return;

  if (champ.type === "nfl") {
    leagueEl.textContent = "NFL";
    nameEl.textContent   = "Super Bowl";
    logoImg.src          = "logos/superbowl.png";
  } else {
    leagueEl.textContent = "MLB";
    nameEl.textContent   = "World Series";
    logoImg.src          = "logos/worldseries.png";
  }

  const line = buildGameLine(champ.competition);
  const st   = buildStatus(champ.event);

  gameEl.textContent = line;
  gameEl.classList.remove("error-text");
  pillEl.textContent = st.pill;
  pillEl.className   = st.pillClass;

  if (champ.type === "nfl" && st.state === "in") {
    const situText = buildFootballSituation(champ.competition, champ.event);
    textEl.textContent = situText || st.text;
  } else if (champ.type === "mlb" && st.state === "in") {
    const bSitu = buildBaseballSituation(champ.competition, champ.event);
    textEl.textContent = bSitu || st.text;
  } else {
    textEl.textContent = st.text;
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
  setCardLoading("champ");

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

    updateChampionshipCard(mlbData, nflData);

  } catch (err) {
    console.error("Error refreshing scores:", err);
    Object.values(TEAM_CONFIG).forEach(team => setCardError(team.prefix));
    setCardError("champ");
  }
}

// Initial load
window.addEventListener("load", () => {
  refreshScores();
  setInterval(refreshScores, 60 * 1000);
});
