(async () => {
  try {
    const response = await fetch(
      "./data/position-matchups.json?t="
      + Date.now(),
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        "position-matchups.json HTTP "
        + response.status
      );
    }

    const data =
      await response.json();

    const defense =
      data.defense || {};

    if (
      typeof model !== "function"
      ||
      typeof renderAll !== "function"
    ) {
      throw new Error(
        "EuroFantasy model "
        + "is not ready"
      );
    }

    if (
      window
        .__positionMatchupsPatched
    ) {
      return;
    }

    window
      .__positionMatchupsPatched =
        true;

    const originalModel =
      model;

    function teamKey(value) {
      const n = String(
        value || ""
      ).toLowerCase();

      const rules = [
        [
          "efes",
          "Anadolu Efes"
        ],
        [
          "armani",
          "Milano"
        ],
        [
          "milano",
          "Milano"
        ],
        [
          "milan",
          "Milano"
        ],
        [
          "besiktas",
          "Besiktas"
        ],
        [
          "crvena",
          "Crvena Zvezda"
        ],
        [
          "red star",
          "Crvena Zvezda"
        ],
        [
          "dubai",
          "Dubai"
        ],
        [
          "barcelona",
          "Barcelona"
        ],
        [
          "bayern",
          "Bayern Munich"
        ],
        [
          "fenerbahce",
          "Fenerbahce"
        ],
        [
          "hapoel",
          "Hapoel Tel Aviv"
        ],
        [
          "baskonia",
          "Baskonia"
        ],
        [
          "asvel",
          "ASVEL"
        ],
        [
          "maccabi",
          "Maccabi Tel Aviv"
        ],
        [
          "olympiacos",
          "Olympiacos"
        ],
        [
          "panathinaikos",
          "Panathinaikos"
        ],
        [
          "paris",
          "Paris"
        ],
        [
          "partizan",
          "Partizan"
        ],
        [
          "real madrid",
          "Real Madrid"
        ],
        [
          "valencia",
          "Valencia"
        ],
        [
          "virtus",
          "Virtus Bologna"
        ],
        [
          "zalgiris",
          "Zalgiris"
        ],
        [
          "monaco",
          "Monaco"
        ]
      ];

      for (
        const [
          needle,
          canonical
        ]
        of rules
      ) {
        if (
          n.includes(needle)
        ) {
          return canonical;
        }
      }

      return String(
        value || ""
      );
    }

    model = function (p) {
      const x =
        originalModel(p);

      const pos =
        ["G", "F", "C"]
          .includes(p.pos)
          ? p.pos
          : null;

      const opponent =
        teamKey(
          x.match?.opponent
          || p.opponent
        );

      const row =
        pos
          ? defense?.[opponent]?.[
              pos
            ]
          : null;

      const factor =
        Number(
          row?.factor || 1
        );

      const teamMatchPct =
        Number(
          x.matchPct || 0
        );

      x.teamMatchPct =
        teamMatchPct;

      x.positionMatchPct =
        (
          factor - 1
        ) * 100;

      x.positionMatchup =
        row || null;

      if (
        p.status !== "out"
        &&
        Number.isFinite(factor)
        &&
        factor > 0
      ) {
        x.expected *=
          factor;

        x.floor *=
          factor;

        x.ceiling *=
          factor;

        x.value =
          x.expected
          /
          Math.max(
            0.1,
            Number(p.price)
          );

        const teamFactor =
          1
          + teamMatchPct
          / 100;

        x.matchPct =
          (
            teamFactor
            * factor
            - 1
          ) * 100;
      }

      return x;
    };

    renderAll();

    console.log(
      "Position matchups loaded:",
      Object.keys(
        defense
      ).length,
      "teams"
    );

  } catch (error) {
    console.error(
      "Position matchup error:",
      error
    );
  }
})();
