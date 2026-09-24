(async () => {
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

  try {
    const t = Date.now();

    const [playersResponse, metaResponse] = await Promise.all([
      fetch("./data/players.json?t=" + t, { cache: "no-store" }),
      fetch("./data/meta.json?t=" + t, { cache: "no-store" })
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

    if (metaResponse.ok) {
      const meta = await metaResponse.json();

      localStorage.setItem(
        "efa2_fantasy_sync",
        meta.updated_at || new Date().toISOString()
      );
    }

    renderAll();

    const badge = document.getElementById("syncBadge");

    if (badge) {
      badge.textContent = "Fantasy live ✓";

      setTimeout(() => {
        badge.textContent = "Fantasy live ✓";
      }, 3000);
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
})();
