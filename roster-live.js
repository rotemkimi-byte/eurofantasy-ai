(async () => {
  try {
    const response = await fetch(
      "./data/roster.json?t=" + Date.now(),
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("roster.json HTTP " + response.status);
    }

    const roster = await response.json();
    const names = Array.isArray(roster.players)
      ? roster.players
      : [];

    const applyRoster = () => {
      const available = new Set(
        (Array.isArray(players) ? players : [])
          .map(p => p.name)
      );

      const selected = names.filter(
        name => available.has(name)
      );

      if (!selected.length) return;

      myTeam = selected;

      localStorage.setItem(
        LS.team,
        JSON.stringify(myTeam)
      );

      localStorage.setItem(
        "efa2_roster_sync",
        roster.updated_at ||
        new Date().toISOString()
      );

      renderAll();
    };

    applyRoster();

    setTimeout(applyRoster, 800);
    setTimeout(applyRoster, 2000);

  } catch (error) {
    console.error(
      "Fantasy roster live error:",
      error
    );
  }
})();
