(async () => {
  try {
    const response = await fetch(
      "./data/recent-form.json?t="
        + Date.now(),
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(
        "recent-form.json HTTP "
        + response.status
      );
    }

    const payload =
      await response.json();

    const form =
      payload.players || {};

    const sleep = ms =>
      new Promise(resolve =>
        setTimeout(resolve, ms)
      );

    for (
      let i = 0;
      i < 50
      && !window.__positionMatchupsPatched;
      i++
    ) {
      await sleep(100);
    }

    if (
      typeof model !== "function"
      || typeof renderAll
        !== "function"
    ) {
      throw new Error(
        "EuroFantasy model not ready"
      );
    }

    if (window.__recentFormPatched) {
      return;
    }

    window.__recentFormPatched = true;
    window.__recentFormData = payload;

    const originalModel = model;

    const norm = value =>
      String(value || "")
        .normalize("NFD")
        .replace(
          /[\u0300-\u036f]/g,
          ""
        )
        .toLowerCase()
        .replace(
          /[^a-z0-9 ]/g,
          " "
        )
        .replace(
          /\s+/g,
          " "
        )
        .trim();

    const clampValue = (
      x,
      min,
      max
    ) =>
      Math.max(
        min,
        Math.min(max, x)
      );

    const valid = value => {
      const n = Number(value);

      return (
        Number.isFinite(n)
        ? n
        : null
      );
    };

    function pricePriorMinutes(
      price
    ) {
      const p =
        Number(price || 0);

      if (p >= 14) return 27;
      if (p >= 10) return 23;
      if (p >= 7) return 19;
      return 14;
    }

    function currentRate(recent) {
      const last =
        valid(
          recent.lastGame
            ?.pirPerMinute
        );

      const prev =
        valid(
          recent.previous4
            ?.pirPerMinute
        );

      const season =
        valid(
          recent.season
            ?.pirPerMinute
        );

      const parts = [];

      if (last !== null) {
        parts.push([0.45, last]);
      }

      if (prev !== null) {
        parts.push([0.35, prev]);
      }

      if (season !== null) {
        parts.push([0.20, season]);
      }

      const total =
        parts.reduce(
          (sum, [w]) =>
            sum + w,
          0
        );

      if (!total) return null;

      return (
        parts.reduce(
          (sum, [w, v]) =>
            sum + w * v,
          0
        ) / total
      );
    }

    function currentMinutes(
      recent
    ) {
      const last =
        valid(
          recent.lastGame
            ?.minutes
        );

      const prev =
        valid(
          recent.previous4
            ?.avgMinutes
        );

      const season =
        valid(
          recent.season
            ?.avgMinutes
        );

      const parts = [];

      if (last !== null) {
        parts.push([0.45, last]);
      }

      if (prev !== null) {
        parts.push([0.30, prev]);
      }

      if (season !== null) {
        parts.push([0.25, season]);
      }

      const total =
        parts.reduce(
          (sum, [w]) =>
            sum + w,
          0
        );

      if (!total) return null;

      return (
        parts.reduce(
          (sum, [w, v]) =>
            sum + w * v,
          0
        ) / total
      );
    }

    function freshSeasonPrior(
      p,
      x
    ) {
      const price =
        Number(p.price || 0);

      const basePir =
        price * 0.93;

      const baseMin =
        pricePriorMinutes(
          price
        );

      let minutes =
        baseMin
        + Number(
            x.injuryBoost || 0
          );

      if (
        p.status
        === "questionable"
      ) {
        minutes *= 0.82;
      }

      if (
        p.status === "out"
      ) {
        minutes = 0;
      }

      const margin =
        Number(
          x.match?.margin || 0
        );

      if (
        margin >= 10
        && price >= 12
      ) {
        minutes *= 0.97;
      }

      if (
        margin >= 10
        && price <= 7
      ) {
        minutes *= 1.05;
      }

      minutes =
        clampValue(
          minutes,
          0,
          36
        );

      const teamPct =
        Number(
          x.teamMatchPct
          ?? x.matchPct
          ?? 0
        );

      const positionPct =
        Number(
          x.positionMatchPct
          ?? 0
        );

      const teamFactor =
        1
        + (
            clampValue(
              teamPct,
              -8,
              8
            ) / 100
          ) * 0.60;

      const positionFactor =
        1
        + (
            clampValue(
              positionPct,
              -12,
              12
            ) / 100
          ) * 0.35;

      const expected =
        p.status === "out"
          ? 0
          : Math.max(
              0,
              basePir
              * (
                  minutes
                  / Math.max(
                      baseMin,
                      1
                    )
                )
              * teamFactor
              * positionFactor
            );

      return {
        expected,
        minutes,
        basePir,
        baseMin,
        teamFactor,
        positionFactor,
      };
    }

    model = function (p) {
      const x =
        originalModel(p);

      const prior =
        freshSeasonPrior(
          p,
          x
        );

      const recent =
        form[norm(p.name)];

      const games =
        Number(
          recent
            ?.currentSeasonGames
          || 0
        );

      // No 2026/27 game yet:
      // use price + current context only.
      if (
        !recent
        || games <= 0
      ) {
        x.expected =
          prior.expected;
        x.minutes =
          prior.minutes;
        x.basePir =
          prior.basePir;
        x.baseMin =
          prior.baseMin;
        x.source =
          "2026/27 price prior";
        x.recentForm = null;
        x.recentDynamic = null;
        x.livePrice =
          Number(p.price);

        const conf =
          p.status === "out"
            ? 95
            : p.status
              === "questionable"
              ? 30
              : 40;

        x.confidence = conf;

        const u =
          1 - conf / 100;

        x.floor =
          x.expected
          * (
              0.76
              - 0.18 * u
            );

        x.ceiling =
          x.expected
          * (
              1.28
              + 0.30 * u
            );

        x.value =
          x.expected
          / Math.max(
              0.1,
              Number(p.price)
            );

        return x;
      }

      if (
        p.status === "out"
      ) {
        x.expected = 0;
        x.minutes = 0;
        x.floor = 0;
        x.ceiling = 0;
        x.value = 0;
        x.confidence = 95;
        x.source =
          "2026/27 current season";
        x.recentForm = recent;
        x.livePrice =
          Number(p.price);
        return x;
      }

      const rate =
        currentRate(recent);

      const observedMinutes =
        currentMinutes(recent);

      if (
        rate === null
        || observedMinutes === null
      ) {
        x.expected =
          prior.expected;
        x.minutes =
          prior.minutes;
        x.source =
          "2026/27 price prior";
        x.recentForm =
          recent;
        return x;
      }

      const sampleWeight =
        clampValue(
          0.28
          + 0.12 * games,
          0.40,
          0.85
        );

      let minutes =
        prior.minutes
        * (1 - sampleWeight)
        + observedMinutes
          * sampleWeight;

      minutes =
        clampValue(
          minutes,
          5,
          36
        );

      const currentExpected =
        rate
        * minutes
        * prior.teamFactor
        * prior.positionFactor;

      const expected =
        prior.expected
        * (1 - sampleWeight)
        + currentExpected
          * sampleWeight;

      const confidence =
        clampValue(
          40 + games * 8,
          40,
          84
        )
        - (
            p.status
            === "questionable"
              ? 18
              : 0
          );

      const conf =
        clampValue(
          confidence,
          25,
          94
        );

      const u =
        1 - conf / 100;

      x.expected =
        Math.max(
          0,
          expected
        );
      x.minutes = minutes;
      x.confidence = conf;
      x.floor =
        x.expected
        * (
            0.76
            - 0.18 * u
          );
      x.ceiling =
        x.expected
        * (
            1.28
            + 0.30 * u
          );
      x.value =
        x.expected
        / Math.max(
            0.1,
            Number(p.price)
          );

      x.source =
        "2026/27 current season";
      x.recentForm = recent;
      x.recentRate = rate;
      x.recentMinutes =
        observedMinutes;
      x.livePrice =
        Number(p.price);
      x.currentSeasonGames =
        games;
      x.currentSeasonWeight =
        sampleWeight;

      return x;
    };

    renderAll();

    console.log(
      "2026/27-only recent form active:",
      Object.keys(form).length,
      "players"
    );

  } catch (error) {
    console.error(
      "2026/27 recent-form error:",
      error
    );
  }
})();
