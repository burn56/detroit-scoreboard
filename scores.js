//////////////////////////////
//  ESPN Scoreboard URLs   //
//////////////////////////////

const ENDPOINTS = {
  mlb:     "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
  lions:   "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  cfb:     "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80",
  nba:     "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
  nhl:     "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard"
};

//////////////////////////////
//  Local Team Config       //
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
  if (!gameEl) return;

  showCard(prefix);
  gameEl.textContent = "Loading...";
  pillEl.textContent = "...";
  pillEl.className   = "status-pill";
  textEl.textContent = "";
}

function setCardError(prefix) {
  const gameEl = document.getElementById(`${prefix}-game`);
  const pillEl = document.getElementById(`${prefix}-status-pill`);
  const textEl = document.getElementById(`${prefix}-status-text`);
  if (!gameEl) return;

  showCard(prefix);
  gameEl.textContent = "Error loading scores";
  gameEl.classList.add("error-text");
  pillEl.textContent = "Error";
  pillEl.className   = "status-pill";
  textEl.textContent = "";
}

function setCardNoGame(prefix) {
  hideCard(prefix);
}

//////////////////////////////
//  Parsing Helpers         //
//////////////////////////////

function findTeamGame(events, abbr) {
  if (!Array.isArray(events)) return null;

  for (const event of events) {
    const comp = event.competitions?.[0];
    if (!comp?.competitors) continue;

    const match = comp.competitors.find(c => c.team?.abbreviation === abbr);
    if (match) return { event, competition: comp };
  }
  return null;
}

function buildGameLine(competition) {
  const home = competition.competitors.find(c => c.homeAway === "home");
  const away = competition.competitors.find(c => c.homeAway === "away");

  const homeAbbr = home?.team?.abbreviation ?? "HOME";
  const awayAbbr = away?.team?.abbreviation ?? "AWAY";

  const homeScore = home?.score ?? "-";
  const awayScore = away?.score ?? "-";

  return `${awayAbbr} ${awayScore} @ ${homeAbbr} ${homeScore}`;
}

function buildStatus(event) {
  const state = event?.status?.type?.state ?? "pre";
  let pill = "Scheduled";
  let pillClass = "status-pill scheduled";
  let text = event?.status?.type?.shortDetail ?? "";

  if (state === "in") { pill = "Live"; pillClass = "status-pill live"; }
  if (state === "post") { pill = "Final"; pillClass = "status-pill final"; }

  return { pill, pillClass, text, state };
}

//////////////////////////////
//  Football Situation      //
//////////////////////////////

function buildFootballSituation(comp, event) {
  const sit = comp.situation;
  if (!sit) return "";

  const period = event.status.period;
  const clock  = event.status.displayClock;

  const down = sit.down;
  const dist = sit.distance;
  const ord = {1:"1st",2:"2nd",3:"3rd",4:"4th"}[down] || "";

  const possAbbr = comp.competitors.find(c =>
    String(c.id) === String(sit.possession) ||
    String(c.team?.id) === String(sit.possession)
  )?.team?.abbreviation ?? "";

  const pieces = [];
  if (period) pieces.push(`Q${period}`);
  if (clock) pieces.push(clock);
  if (down && dist != null) pieces.push(`${ord} & ${dist}`);
  if (possAbbr) pieces.push(`${possAbbr} ball`);

  return pieces.join(" • ");
}

//////////////////////////////
//  Baseball Situation      //
//////////////////////////////

function buildBaseballSituation(comp) {
  const sit = comp.situation;
  if (!sit) return "";

  const inning = sit.inning;
  const half = sit.inningHalf || (sit.isTopInning ? "Top" : "Bot");

  const balls = sit.balls;
  const strikes = sit.strikes;
  const outs = sit.outs;

  const bases = [
    sit.onFirst ? "1" : "-",
    sit.onSecond ? "2" : "-",
    sit.onThird ? "3" : "-"
  ].join("");

  return `${half} ${inning} • B:${balls} S:${strikes} • O:${outs} • Bases:${bases}`;
}

//////////////////////////////
//  Update Team Card        //
//////////////////////////////

function updateTeamCard(prefix, abbr, data, isFootball, isBaseball) {
  const hit = findTeamGame(data.events, abbr);
  if (!hit) return setCardNoGame(prefix);

  showCard(prefix);

  const line = buildGameLine(hit.competition);
  const st = buildStatus(hit.event);

  const gameEl = document.getElementById(`${prefix}-game`);
  const pillEl = document.getElementById(`${prefix}-status-pill`);
  const textEl = document.getElementById(`${prefix}-status-text`);

  gameEl.textContent = line;
  pillEl.textContent = st.pill;
  pillEl.className   = st.pillClass;

  if (isFootball && st.state === "in") {
    textEl.textContent = buildFootballSituation(hit.competition, hit.event);
  } else if (isBaseball && st.state === "in") {
    textEl.textContent = buildBaseballSituation(hit.competition);
  } else {
    textEl.textContent = st.text;
  }
}

//////////////////////////////
//  Championship Logic      //
//////////////////////////////

function findChampionshipGame(allScoreboards) {
  for (const sb of allScoreboards) {
    for (const ev of sb.events ?? []) {

      const name = ev.name?.toLowerCase() ?? "";

      if (name.includes("super bowl"))
        return { league: "NFL", logo: "superbowl.png", event: ev, competition: ev.competitions[0] };

      if (name.includes("world series"))
        return { league: "MLB", logo: "worldseries.png", event: ev, competition: ev.competitions[0] };

      if (name.includes("national championship"))
        return { league: "CFB", logo: "collegefootball.png", event: ev, competition: ev.competitions[0] };
    }
  }
  return null;
}

function updateChampionshipCard(champ) {
  if (!champ) return hideCard("champ");

  showCard("champ");

  document.getElementById("champ-league").textContent = champ.league;
  document.getElementById("champ-name").textContent = champ.event.name;
  document.querySelector("#champ-card img").src = `logos/${champ.logo}`;

  const line = buildGameLine(champ.competition);
  const st = buildStatus(champ.event);

  document.getElementById("champ-game").textContent = line;
  const pillEl = document.getElementById("champ-status-pill");
  pillEl.textContent = st.pill;
  pillEl.className = st.pillClass;

  const textEl = document.getElementById("champ-status-text");
  textEl.textContent = st.text;
}

//////////////////////////////
//  Fetch + Refresh Logic   //
//////////////////////////////

async function fetchScoreboard(url) {
  const res = await fetch(url, { cache: "no-store" });
  return res.ok ? res.json() : {};
}

async function refreshScores() {
  Object.values(TEAM_CONFIG).forEach(t => setCardLoading(t.prefix));
  setCardLoading("champ");

  const [mlb, nfl, cfb, nba, nhl] = await Promise.all([
    fetchScoreboard(ENDPOINTS.mlb),
    fetchScoreboard(ENDPOINTS.lions),
    fetchScoreboard(ENDPOINTS.cfb),
    fetchScoreboard(ENDPOINTS.nba),
    fetchScoreboard(ENDPOINTS.nhl)
  ]);

  updateTeamCard("tigers", "DET", mlb, false, true);
  updateTeamCard("giants", "SF", mlb, false, true);
  updateTeamCard("lions", "DET", nfl, true, false);
  updateTeamCard("michigan", "MICH", cfb, true, false);
  updateTeamCard("msu", "MSU", cfb, true, false);

  const champ = findChampionshipGame([mlb, nfl, cfb, nba, nhl]);
  updateChampionshipCard(champ);
}

refreshScores();
setInterval(refreshScores, 60000);
