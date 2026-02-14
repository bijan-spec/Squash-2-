// ============================================
// WashU Squash - CSA Club Nationals 2026
// App Logic
// ============================================

(function () {
  "use strict";

  var data = TOURNAMENT_DATA;
  var REFRESH_INTERVAL = 60000; // Check for new data every 60 seconds

  // ---- Initialize ----
  document.addEventListener("DOMContentLoaded", function () {
    renderAll();
    initMobileMenu();
    startAutoRefresh();
  });

  function renderAll() {
    renderPlayerLiveMatch();
    renderPlayerMatches();
    renderTeamOverview();
    renderTeamMatches();
    renderLastUpdated();
  }

  // ---- Auto-refresh: fetch data.json periodically ----
  function startAutoRefresh() {
    setInterval(function () {
      fetchLatestData();
    }, REFRESH_INTERVAL);
  }

  function fetchLatestData() {
    // Fetch data.json with a cache-busting query param
    var url = "data.json?_t=" + Date.now();
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        try {
          var newData = JSON.parse(xhr.responseText);
          // Only re-render if data actually changed
          if (newData.tournament && newData.tournament.lastUpdated !== data.tournament.lastUpdated) {
            data = newData;
            renderAll();
          }
        } catch (e) {
          // JSON parse failed — ignore, will retry next interval
        }
      }
    };
    xhr.onerror = function () {
      // Network error — ignore, will retry next interval
    };
    xhr.send();
  }

  // ---- Mobile menu toggle ----
  function initMobileMenu() {
    var btn = document.getElementById("mobileMenuBtn");
    var menu = document.getElementById("mobileMenu");
    if (!btn || !menu) return;

    btn.addEventListener("click", function () {
      menu.classList.toggle("open");
    });

    // Close menu when a link is clicked
    var links = menu.querySelectorAll("a");
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener("click", function () {
        menu.classList.remove("open");
      });
    }
  }

  // ---- Render live match link ----
  function renderPlayerLiveMatch() {
    var container = document.getElementById("playerLiveMatch");
    if (!container) return;

    if (data.featuredPlayerMatchUrl) {
      container.innerHTML =
        '<a href="' + escHtml(data.featuredPlayerMatchUrl) + '" target="_blank" rel="noopener" class="live-match-link">' +
        '<span class="live-match-pulse"></span>' +
        '<span class="live-match-text">View Live Scores on Club Locker</span>' +
        '<span class="live-match-arrow">&rarr;</span>' +
        '</a>';
    } else {
      container.innerHTML = '';
    }
  }

  // ---- Collect all James Sabet matches ----
  function getAllPlayerMatches() {
    var matches = [];

    // Extract from team match individuals
    for (var i = 0; i < data.teamMatches.length; i++) {
      var tm = data.teamMatches[i];
      if (!tm.individuals) continue;
      for (var j = 0; j < tm.individuals.length; j++) {
        var ind = tm.individuals[j];
        if (ind.washuPlayer === data.featuredPlayer) {
          matches.push({
            round: tm.round,
            date: tm.date,
            opponent: ind.opponent,
            oppSchool: ind.oppSchool || tm.opponent,
            position: ind.position,
            result: ind.result,
            games: ind.games || "",
            score: ind.score || ""
          });
        }
      }
    }

    // Add any manually entered player matches (avoid duplicates by round)
    var existingRounds = {};
    for (var k = 0; k < matches.length; k++) {
      existingRounds[matches[k].round] = true;
    }
    for (var m = 0; m < data.playerMatches.length; m++) {
      var pm = data.playerMatches[m];
      if (!existingRounds[pm.round]) {
        matches.push(pm);
      }
    }

    return matches;
  }

  // ---- Render player spotlight matches ----
  function renderPlayerMatches() {
    var container = document.getElementById("playerMatches");
    if (!container) return;

    var matches = getAllPlayerMatches();

    if (matches.length === 0) {
      container.innerHTML =
        '<h4>Match Results</h4>' +
        '<div class="no-matches-msg">' +
        'Match draws and lineups will appear here once announced. ' +
        'Check <a href="https://clublocker.com/tournaments/18567/draws?divisionId=302&sectionId=38&viewMode=detailed&offset=0" target="_blank" rel="noopener">Club Locker</a> ' +
        'for the latest draws and live scores.' +
        '</div>';
      return;
    }

    var html = '<h4>Match Results</h4>';
    for (var i = 0; i < matches.length; i++) {
      var m = matches[i];
      html += renderPlayerMatchRow(m);
    }
    container.innerHTML = html;
  }

  function renderPlayerMatchRow(m) {
    var statusClass = m.result || "upcoming";
    var statusLabel = statusClass.charAt(0).toUpperCase() + statusClass.slice(1);

    var html = '<div class="player-match-row">';
    html += '<span class="pm-round">' + escHtml(m.round) + '</span>';
    html += '<span class="pm-opponent">' + escHtml(m.opponent || "TBD");
    if (m.oppSchool) {
      html += ' <span class="pm-opp-school">(' + escHtml(m.oppSchool) + ')</span>';
    }
    html += '</span>';
    if (m.score) {
      html += '<span class="pm-score">' + escHtml(m.score) + '</span>';
    }
    if (m.games) {
      html += '<span class="pm-games">' + escHtml(m.games) + '</span>';
    }
    html += '<span class="pm-status ' + statusClass + '">' + statusLabel + '</span>';
    html += '</div>';
    return html;
  }

  // ---- Render team overview stats ----
  function renderTeamOverview() {
    var container = document.getElementById("teamOverview");
    if (!container) return;

    var wins = 0;
    var losses = 0;
    var played = 0;
    var upcoming = 0;

    for (var i = 0; i < data.teamMatches.length; i++) {
      var tm = data.teamMatches[i];
      if (tm.status === "completed") {
        played++;
        if (tm.washuScore !== null && tm.opponentScore !== null) {
          if (tm.washuScore > tm.opponentScore) wins++;
          else losses++;
        }
      } else if (tm.status === "upcoming" || tm.status === "live") {
        upcoming++;
      }
    }

    var html = '';
    html += '<div class="team-stat"><div class="team-stat-num">' + played + '</div><div class="team-stat-label">Played</div></div>';
    html += '<div class="team-stat"><div class="team-stat-num">' + wins + '</div><div class="team-stat-label">Wins</div></div>';
    html += '<div class="team-stat"><div class="team-stat-num">' + losses + '</div><div class="team-stat-label">Losses</div></div>';
    html += '<div class="team-stat"><div class="team-stat-num">' + upcoming + '</div><div class="team-stat-label">Upcoming</div></div>';

    container.innerHTML = html;
  }

  // ---- Render team match cards ----
  function renderTeamMatches() {
    var container = document.getElementById("teamMatchCards");
    if (!container) return;

    if (data.teamMatches.length === 0) {
      container.innerHTML = '<div class="no-matches-msg">No matches scheduled yet.</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < data.teamMatches.length; i++) {
      html += renderTeamMatchCard(data.teamMatches[i]);
    }
    container.innerHTML = html;

    // Attach toggle listeners
    var headers = container.querySelectorAll(".match-card-header");
    for (var j = 0; j < headers.length; j++) {
      headers[j].addEventListener("click", toggleMatchCard);
    }
  }

  function renderTeamMatchCard(tm) {
    var scoreDisplay = "";
    var scoreClass = "";
    var statusClass = tm.status;
    var statusLabel = "";

    if (tm.status === "completed" && tm.washuScore !== null) {
      scoreDisplay = tm.washuScore + " \u2013 " + tm.opponentScore;
      scoreClass = tm.washuScore > tm.opponentScore ? "win" : "loss";
      statusLabel = tm.washuScore > tm.opponentScore ? "Win" : "Loss";
    } else if (tm.status === "live") {
      scoreDisplay = (tm.washuScore || 0) + " \u2013 " + (tm.opponentScore || 0);
      statusLabel = "Live";
    } else {
      scoreDisplay = "vs";
      statusLabel = "Upcoming";
    }

    var html = '<div class="match-card" data-match-id="' + tm.id + '">';

    // Header
    html += '<div class="match-card-header">';
    html += '<div class="mch-teams">';
    html += '<span class="mch-team washu">WashU</span>';
    html += '<span class="mch-score ' + scoreClass + '">' + scoreDisplay + '</span>';
    html += '<span class="mch-team">' + escHtml(tm.opponent || "TBD") + '</span>';
    html += '</div>';
    html += '<div class="mch-info">';
    html += '<span class="mch-round">' + escHtml(tm.round) + '</span>';
    html += '<span class="mch-status ' + statusClass + '">' + statusLabel + '</span>';
    if (tm.individuals && tm.individuals.length > 0) {
      html += '<span class="mch-toggle">&#9660;</span>';
    }
    html += '</div>';
    html += '</div>';

    // Body (individual results)
    if (tm.individuals && tm.individuals.length > 0) {
      html += '<div class="match-card-body">';
      for (var i = 0; i < tm.individuals.length; i++) {
        var ind = tm.individuals[i];
        var isHighlight = ind.washuPlayer === data.featuredPlayer;
        html += '<div class="individual-row' + (isHighlight ? ' highlight' : '') + '">';
        html += '<span class="ind-pos">#' + ind.position + '</span>';
        html += '<span class="ind-washu-player">' + escHtml(ind.washuPlayer || "TBD") + '</span>';
        if (ind.result && ind.result !== "upcoming") {
          html += '<span class="ind-result ' + ind.result + '">' + ind.result + '</span>';
        } else {
          html += '<span class="ind-result upcoming">\u2013</span>';
        }
        html += '<span class="ind-opp-player">' + escHtml(ind.opponent || "TBD") + (ind.oppSchool ? ' (' + escHtml(ind.oppSchool) + ')' : '') + '</span>';
        html += '<span class="ind-score">' + escHtml(ind.games || "") + '</span>';
        html += '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  function toggleMatchCard(e) {
    var header = e.currentTarget;
    var card = header.parentElement;
    var body = card.querySelector(".match-card-body");
    var toggle = header.querySelector(".mch-toggle");
    if (!body) return;

    body.classList.toggle("open");
    if (toggle) toggle.classList.toggle("open");
  }

  // ---- Last updated ----
  function renderLastUpdated() {
    var el = document.getElementById("lastUpdated");
    if (!el) return;

    var d = new Date(data.tournament.lastUpdated);
    var options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short"
    };
    el.textContent = "Last updated: " + d.toLocaleDateString("en-US", options) + " (auto-refreshes every 60s)";
  }

  // ---- Utility ----
  function escHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

})();
