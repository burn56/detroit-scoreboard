//////////////////////////////
//  ESPN Scoreboard URLs   //
//////////////////////////////

const ENDPOINTS = {
  tigers: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
  lions: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  michigan: "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80",
  msu: "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80"
};

//////////////////////////////
//  Team Configuration      //
//////////////////////////////

const TEAM_CONFIG = {
  tigers:   { abbr: "DET",  prefix: "tigers" },
  lions:    { abbr: "DET",  prefix: "lions" },
  michigan: { abbr: "MICH", prefix: "michigan" },
  msu:      { abbr: "MSU",  prefix: "msu" }
};

//////////////////////////////
//  DOM Helpers             //
//////////////////////////////

function setCardLoading(prefix) {
  document.getElementById(`${prefix}-game`).textContent = "Loading...";
  const pill = document.getElementById(`${prefix}-status-pill`);
  pill.textContent = "...";
  pill.className = "status-pill";
  document.getElementById(`${prefix}-status-text`).textContent = "";
}

function setCardError(prefix) {
  const game = document.getElementById(`${prefix}-game`);
  game.textContent = "Error loading scores";
  game.classList.add("error-text");
  const pill = document.getElementById(`${prefix}-status-pill`);
  pill.textContent = "Error";
  pill.className = "status-pill";
  document.getElementById(`${prefix}-status-text`).textContent = "";
}

function setCardNoGame(prefix) {
  document.getElementById(`${prefix}-game`).textContent = "No game today";
  const pill = document.getElementById(`${prefix}-status-pill`);
  pill.textContent = "Idle";
  pill.className = "status-pill";
  document.getElementById(`${prefix}-status-text`).textContent = "";
}

//////////////////////////////
//  ESPN Parsing            //
//////////////////////////////

function findTeamGame(events, abbr) {
  if (!Array.isArray(events)) return null;

  for (const event of events) {
    const comp = event.competitions?.[0];
    if (!comp) continue;

    const competitors = comp.competitors || [];
    const found = competitors.find(
      (c) => c.team?.abbreviation === abbr
    );

    if (found) return { event, competition: comp };
  }

  return null;
}

function buildGameLine(comp) {
  const competitors = comp.competitors || [];
  const home = competitors.find(c => c.homeAway === "home") || competitors[0];
  const away = competitors.find(c => c.homeAway === "away") || competitors[1];

  return `${away.team.abbreviation} ${away.score ?? "-"} @ ${home.team.abbreviation} ${home.score ?? "-"}`;
}

function buildStatus(event) {
  const s = event.status || {};
  const t = s.type || {};
  const state = t.state || "pre";

  let pill = "Scheduled";
  let pillClass = "status-pill scheduled";
  let text = t.shortDetail || t.detail || "";

  if (state === "in") {
    pill = "Live";
    pillClass = "status-pill live";
  } else if (state === "post") {
    pill = "Final";
    pillClass = "status-pill final";
  }

  return { pill, pillClass, text };
}

//////////////////////////////
//  Update Cards            //
//////////////////////////////

function updateTeamCard(prefix, abbr, data) {
  try {
    const game = findTeamGame(data.events || [], abbr);
    if (!game) return setCardNoGame(prefix);

    const line = buildGameLine(game.competition);
    const st = buildStatus(game.event);

    document.getElementById(`${prefix}-game`).textContent = line;
    const pill = document.getElementById(`${prefix}-status-pill`);
    pill.textContent = st.pill;
    pill.className = st.pillClass;
    document.getElementById(`${prefix}-status-text`).textContent = st.text;

  } catch (e) {
    setCardError(prefix);
  }
}

//////////////////////////////
//  Refresh Logic           //
//////////////////////////////

async function fetchScoreboard(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

async function refresh() {
  Object.values(TEAM_CONFIG).forEach(t => setCardLoading(t.prefix));

  try {
    const [mlb, nfl, cfb1, cfb2] = await Promise.all([
      fetchScoreboard(ENDPOINTS.tigers),
      fetchScoreboard(ENDPOINTS.lions),
      fetchScoreboard(ENDPOINTS.michigan),
      fetchScoreboard(ENDPOINTS.msu)
    ]);

    updateTeamCard("tigers", "DET", mlb);
    updateTeamCard("lions", "DET", nfl);
    updateTeamCard("michigan", "MICH", cfb1);
    updateTeamCard("msu", "MSU", cfb2);

    document.getElementById("updated-time").textContent =
      "Last updated: " + new Date().toLocaleTimeString();

  } catch (e) {
    Object.values(TEAM_CONFIG).forEach(t => setCardError(t.prefix));
  }
}

refresh();
setInterval(refresh, 60000);
