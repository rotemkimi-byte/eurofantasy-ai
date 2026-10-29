(() => {
  const aliases = {
    "Anadolu Efes Istanbul": "Anadolu Efes",
    "Armani Olimpia Milan": "Milano",
    "Besiktas Istanbul": "Besiktas",
    "Crvena Zvezda Meridianbet Belgrade": "Crvena Zvezda",
    "Dubai Basketball": "Dubai",
    "FC Barcelona": "Barcelona",
    "FC Bayern Munich": "Bayern Munich",
    "Fenerbahce Tarfin Istanbul": "Fenerbahce",
    "Hapoel IBI Tel Aviv": "Hapoel Tel Aviv",
    "Kosner Baskonia Vitoria-Gasteiz": "Baskonia",
    "LDLC ASVEL Villeurbanne": "ASVEL",
    "Maccabi Rapyd Tel Aviv": "Maccabi Tel Aviv",
    "Olympiacos Piraeus": "Olympiacos",
    "Panathinaikos AKTOR Athens": "Panathinaikos",
    "Paris Basketball": "Paris",
    "Partizan Mozzart Bet Belgrade": "Partizan",
    "Valencia Basket": "Valencia",
    "Zalgiris Kaunas": "Zalgiris"
  };

  const teamName = name => aliases[name] || name || "";

  let pending = null;
  async function refresh() {
  try {
    const t = Date.now();

    const [playersResponse, metaResponse, matchupsResponse] = await Promise.all([
      fetch("./data/players.json?t=" + t, { cache: "no-store" }),
      fetch("./data/meta.json?t=" + t, { cache: "no-store" }),
      fetch("./data/matchups.json?t=" + t, { cache: "no-store" })
    ]);

    if (!playersResponse.ok) {
      throw new Error("players.json HTTP " + playersResponse.status);
    }

    const livePlayers = await playersResponse.json();

    if (!Array.isArray(livePlayers) || !livePlayers.length) {
      throw new Error("No live players received");
    }

    players = livePlayers.map(p => ({
      ...p,
      name: String(p.name || "").trim(),
      team: teamName(p.team),
      opponent: teamName(p.opponent),
      pos: String(p.pos || "").toUpperCase(),
      price: Number(p.price) || 0,
      home: Number(p.home) === 1 ? 1 : 0,
      status: ["active", "questionable", "out"].includes(
        String(p.status || "").toLowerCase()
      )
        ? String(p.status).toLowerCase()
        : "active"
    })).filter(p => p.name && p.pos && p.price > 0);

    localStorage.setItem(LS.players, JSON.stringify(players));

    myTeam = myTeam.filter(name =>
      players.some(player => player.name === name)
    );

    localStorage.setItem(LS.team, JSON.stringify(myTeam));

    const meta = metaResponse.ok ? await metaResponse.json() : null;
    if (meta) {

      localStorage.setItem(
        "efa2_fantasy_sync",
        meta.updated_at || new Date().toISOString()
      );
    }

    if (matchupsResponse.ok) {
      const data = await matchupsResponse.json();
      const schedule = new Map(players.map(p => [p.team, p]));
      const coherent = Object.entries(data.matchups || {}).every(([team, m]) => {
        const p = schedule.get(team);
        return p && p.opponent === m.opponent && !!p.home === !!m.home;
      });
      if (coherent && Object.keys(data.matchups || {}).length) {
        for (const team of Object.keys(MATCHUPS)) delete MATCHUPS[team];
        Object.assign(MATCHUPS, data.matchups);
        GAMES.splice(0, GAMES.length, ...(data.games || []));
      }
    }
    // Never label an old fixture as the next game after the player feed advances.
    for (const p of players) {
      const m = MATCHUPS[p.team];
      if (m && (m.opponent !== p.opponent || !!m.home !== !!p.home)) delete MATCHUPS[p.team];
    }
    GAMES.splice(0, GAMES.length, ...GAMES.filter(g => MATCHUPS[g.home] && MATCHUPS[g.away]));
    renderAll();
    document.dispatchEvent(new Event("fantasy-live-updated"));
    const badge = document.getElementById("syncBadge");
    if (badge) {
      const time = Date.parse(meta?.updated_at);
      const stale = !Number.isFinite(time) || Date.now() - time > 30 * 60 * 1000;
      badge.textContent = (meta?.matchday_number ? "מחזור " + meta.matchday_number : "Fantasy") +
        (stale ? " · נתונים בעיכוב" : " · מעודכן ✓");
      badge.title = Number.isFinite(time) ? "עדכון נתונים: " + new Date(time).toLocaleString("he-IL") : "מועד העדכון לא ידוע";
    }

    console.log(
      "EuroFantasy Live loaded:",
      players.length,
      "players"
    );

  } catch (error) {
    console.error("Fantasy Live error:", error);

    const badge = document.getElementById("syncBadge");

    if (badge) {
      badge.textContent = "Fantasy cache";
    }
  }
  }
  window.refreshFantasyLive = () => {
    if (!pending) pending = refresh().finally(() => { pending = null; });
    return pending;
  };
  void window.refreshFantasyLive();
  setInterval(() => { if (!document.hidden) void window.refreshFantasyLive(); }, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void window.refreshFantasyLive();
  });
  window.addEventListener('focus', () => void window.refreshFantasyLive());
  document.getElementById('pmReload')?.addEventListener('click', () => void window.refreshFantasyLive());
})();

