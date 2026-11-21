(async () => {
  try {
    const response = await fetch(
      "./data/matchups.json?t=" +
      Date.now(),
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(
        "matchups.json HTTP " +
        response.status
      );
    }

    const data =
      await response.json();

    const live =
      data.matchups || {};

    for (
      const [team, value]
      of Object.entries(live)
    ) {
      const {context, contextBase, ...previous} = MATCHUPS[team] || {};
      MATCHUPS[team] = {...previous, ...contextBase, ...value};
    }

    if (
      Array.isArray(data.games)
      && Array.isArray(GAMES)
    ) {
      GAMES.splice(
        0,
        GAMES.length,
        ...data.games
      );
    }

    window.refreshMatchupContext?.();
    renderAll();

    console.log(
      "Live matchups loaded:",
      Object.keys(live).length
    );

  } catch (error) {
    console.error(
      "Live matchup error:",
      error
    );
  }
})();
